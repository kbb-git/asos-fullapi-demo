const express = require("express");
const path = require("path");
const cors = require("cors");
const axios = require("axios");

const app = express();
const port = 8000; // Running on port 8000

// Replace with your actual credentials
const CHECKOUT_SECRET_KEY = "sk_sbox_pe4dlwdatsf7apgkgyafae7in4q";
const PROCESSING_CHANNEL_ID = "pc_eonbfv5qtimefo2mizmgmy3c5y";

app.use(cors());
app.use(express.json());
app.use(express.static('public', {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'checkout.html'));
});

// ***** CARD PAYMENT ENDPOINT *****
app.post("/process-payment", async (req, res) => {
    try {
        const paymentRequest = {
            source: {
                type: "card",
                number: req.body.source.number,
                expiry_month: req.body.source.expiry_month,
                expiry_year: req.body.source.expiry_year,
                cvv: req.body.source.cvv
            },
            amount: 3250,
            currency: "GBP",
            payment_type: "Recurring",
            processing_channel_id: PROCESSING_CHANNEL_ID,
            billing_descriptor: {
                name: "ASOC.COM",
                city: "London"
            },
            "3ds": {
                enabled: true,
                challenge_indicator: "challenge_requested_mandate"
            },
            success_url: `http://localhost:${port}/success`,
            failure_url: `http://localhost:${port}/failure`
        };

        const response = await axios.post(
            "https://api.sandbox.checkout.com/payments",
            paymentRequest,
            {
                headers: {
                    Authorization: `Bearer ${CHECKOUT_SECRET_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        res.json({
            id: response.data.id,
            status: response.data.status,
            redirect_url: response.data._links?.redirect?.href || null
        });
    } catch (error) {
        console.error("Payment error:", error.response?.data || error.message);
        res.status(500).json({
            error: error.response?.data?.error_type || 'Payment processing failed',
            message: error.response?.data?.error_codes?.[0] || error.message
        });
    }
});

// ***** KLARNA PAYMENT CONTEXT *****
app.post('/api/payment-context', async (req, res) => {
    const basketItems = [
        {
            name: "ASOS DESIGN oversized sweatshirt",
            quantity: 1,
            unit_price: 3250,
            total_amount: 3250,
            reference: "ASOC-001"
        }
    ];

    try {
        const total = basketItems.reduce((acc, item) => acc + item.total_amount, 0);
        const requestBody = {
            currency: "EUR",
            amount: total,
            source: {
                type: "klarna",
                account_holder: {
                    billing_address: {
                        country: "DE"
                    }
                }
            },
            items: basketItems,
            processing: {
                locale: "en-GB"
            },
            processing_channel_id: PROCESSING_CHANNEL_ID,
            success_url: `http://localhost:${port}/success`,
            failure_url: `http://localhost:${port}/failure`
        };

        const response = await axios.post(
            'https://api.sandbox.checkout.com/payment-contexts',
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CHECKOUT_SECRET_KEY}`,
                    'Accept': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error creating Klarna payment context:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create payment context', details: error.message });
    }
});

// ***** KLARNA FINAL PAYMENT *****
app.post('/api/payments', async (req, res) => {
    try {
        const { payment_context_id } = req.body;
        if (!payment_context_id) {
            throw new Error('Payment context ID is required');
        }

        const paymentRequest = {
            payment_context_id,
            processing_channel_id: PROCESSING_CHANNEL_ID
        };

        const paymentResponse = await axios.post(
            'https://api.sandbox.checkout.com/payments',
            paymentRequest,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CHECKOUT_SECRET_KEY}`,
                    'Accept': 'application/json'
                }
            }
        );

        // Fetch payment details
        const paymentDetailsResponse = await axios.get(
            `https://api.sandbox.checkout.com/payments/${paymentResponse.data.id}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CHECKOUT_SECRET_KEY}`,
                    'Accept': 'application/json'
                }
            }
        );

        res.json(paymentDetailsResponse.data);
    } catch (error) {
        console.error('Klarna payment error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to process Klarna payment',
            details: error.message
        });
    }
});

// ***** iDEAL PAYMENT *****
app.post('/api/ideal-payments', async (req, res) => {
    try {
        const paymentRequest = {
            source: {
                type: "ideal",
                description: "ORD50234E89",
                language: "nl"
            },
            amount: 2000, // €20.00 in cents
            currency: "EUR",
            reference: "iDEALabcde21",
            processing_channel_id: PROCESSING_CHANNEL_ID,
            success_url: `http://localhost:${port}/success`,
            failure_url: `http://localhost:${port}/failure`
        };

        const response = await axios.post(
            'https://api.sandbox.checkout.com/payments',
            paymentRequest,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CHECKOUT_SECRET_KEY}`,
                    'Accept': 'application/json'
                }
            }
        );

        const redirectUrl = response.data._links?.redirect?.href;

        if (!redirectUrl) {
            throw new Error('Redirect URL not found in iDEAL payment response');
        }

        res.json({ redirectUrl });
    } catch (error) {
        console.error('Error processing iDEAL payment:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to process iDEAL payment',
            details: error.message
        });
    }
});

app.get("/success", (req, res) => {
    res.send('Payment successful! You can close this window.');
});

app.get("/failure", (req, res) => {
    res.send('Payment failed. Please try again.');
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!', details: err.message });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});