document.addEventListener('DOMContentLoaded', function() {
    const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');
    const cardForm = document.getElementById('card-payment-form');
    const klarnaContainer = document.getElementById('klarna-container');
    const idealContainer = document.getElementById('ideal-container');
    const klarnaPayButton = document.getElementById('klarna-pay-button');
    const klarnaStatus = document.getElementById('klarna-status');
    const idealPayButton = document.getElementById('ideal-pay-button');
    const idealStatus = document.getElementById('ideal-status');

    // By default, no method selected, hide all forms
    let selectedMethod = null;
    cardForm.style.display = 'none';
    klarnaContainer.style.display = 'none';
    idealContainer.style.display = 'none';

    paymentMethodRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            selectedMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
            togglePaymentMethodUI(selectedMethod);
        });
    });

    function togglePaymentMethodUI(method) {
        if (method === 'card') {
            cardForm.style.display = 'block';
            klarnaContainer.style.display = 'none';
            idealContainer.style.display = 'none';
        } else if (method === 'klarna') {
            cardForm.style.display = 'none';
            klarnaContainer.style.display = 'block';
            idealContainer.style.display = 'none';
            initializeKlarnaPayment();
        } else if (method === 'ideal') {
            cardForm.style.display = 'none';
            klarnaContainer.style.display = 'none';
            idealContainer.style.display = 'block';
        }
    }

    // CARD LOGIC
    const form = document.getElementById('payment-form');
    const payButton = form ? form.querySelector('.pay-button') : null;
    const errorElement = document.getElementById('error-message');
    const successElement = document.getElementById('successful-payment-message');

    if (form) {
        const cardNumberInput = form.querySelector('[name="cardNumber"]');
        const expiryMonthInput = form.querySelector('[name="expiryMonth"]');
        const expiryYearInput = form.querySelector('[name="expiryYear"]');
        const cvvInput = form.querySelector('[name="cvv"]');

        cardNumberInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/(.{4})/g, '$1 ').trim();
            e.target.value = value;
        });

        expiryMonthInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 0) {
                value = Math.min(Math.max(parseInt(value), 1), 12).toString();
            }
            e.target.value = value;
        });

        expiryYearInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            e.target.value = value;
        });

        cvvInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            e.target.value = value;
        });

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (selectedMethod !== 'card') return;

            errorElement.innerHTML = '';
            successElement.innerHTML = '';

            payButton.disabled = true;
            payButton.innerHTML = 'Processing...';

            try {
                const cardNumber = cardNumberInput.value.replace(/\s/g, '');
                const expiryMonth = parseInt(expiryMonthInput.value);
                const expiryYear = parseInt(expiryYearInput.value);
                const cvv = cvvInput.value;

                if (cardNumber.length < 16) {
                    throw new Error('Please enter a valid card number');
                }
                if (expiryMonth < 1 || expiryMonth > 12) {
                    throw new Error('Please enter a valid expiry month (1-12)');
                }
                if (expiryYear < 23) {
                    throw new Error('Card has expired');
                }
                if (cvv.length < 3) {
                    throw new Error('Please enter a valid security code');
                }

                const response = await fetch('/process-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: {
                            number: cardNumber,
                            expiry_month: expiryMonth,
                            expiry_year: expiryYear,
                            cvv: cvv
                        }
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Payment failed');
                }

                if (data.redirect_url) {
                    window.location.href = data.redirect_url;
                    return;
                }

                successElement.innerHTML = 'Payment successful!';
                setTimeout(() => {
                    window.location.href = '/success';
                }, 1000);

            } catch (error) {
                errorElement.innerHTML = error.message;
                payButton.disabled = false;
                payButton.innerHTML = 'Pay';
            }
        });
    }

    // KLARNA LOGIC
    let paymentContext = null;
    let klarnaInitialized = false;

    async function initializeKlarnaPayment() {
        klarnaPayButton.disabled = true;
        klarnaStatus.innerHTML = 'Initializing Klarna...';

        try {
            const response = await fetch('/api/payment-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }});
            if (!response.ok) throw new Error('Failed to create Klarna payment context');
            paymentContext = await response.json();

            if (!window.Klarna) {
                throw new Error('Klarna SDK not loaded');
            }

            window.Klarna.Payments.init({ client_token: paymentContext.partner_metadata.client_token });
            window.Klarna.Payments.load({ container: '#klarna-payments-container' }, {}, function(res) {
                if (res.show_form) {
                    klarnaInitialized = true;
                    klarnaStatus.innerHTML = 'Klarna ready. Click Pay to proceed.';
                    klarnaPayButton.disabled = false;
                } else if (res.error) {
                    klarnaStatus.innerHTML = 'Error loading Klarna form: ' + res.error;
                } else {
                    klarnaStatus.innerHTML = 'Unknown error loading Klarna';
                }
            });
        } catch (error) {
            klarnaStatus.innerHTML = 'Error: ' + error.message;
        }
    }

    klarnaPayButton.addEventListener('click', handleKlarnaPayment);

    function handleKlarnaPayment() {
        if (!klarnaInitialized) {
            klarnaStatus.innerHTML = 'Klarna not initialized';
            return;
        }
        klarnaPayButton.disabled = true;
        klarnaStatus.innerHTML = 'Authorizing with Klarna...';
        window.Klarna.Payments.authorize({}, {
            billing_address: {
                given_name: "John",
                family_name: "Doe",
                email: "john@doe.com",
                street_address: "Mainstrasse 1",
                postal_code: "12345",
                city: "Berlin",
                country: "DE",
                phone: "+49123456789"
            },
            shipping_address: {
                given_name: "John",
                family_name: "Doe",
                email: "john@doe.com",
                street_address: "Mainstrasse 1",
                postal_code: "12345",
                city: "Berlin",
                country: "DE",
                phone: "+49123456789"
            },
            customer: {
                date_of_birth: "1990-01-01"
            }
        }, async function(result) {
            if (result.approved) {
                klarnaStatus.innerHTML = 'Klarna authorized, finalizing payment...';
                await finalizeKlarnaPayment();
            } else if (result.show_form) {
                klarnaStatus.innerHTML = 'Please complete the Klarna form';
                klarnaPayButton.disabled = false;
            } else {
                klarnaStatus.innerHTML = 'Klarna payment not approved';
                klarnaPayButton.disabled = false;
            }
        });
    }

    async function finalizeKlarnaPayment() {
        try {
            const response = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_context_id: paymentContext.id })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error('Klarna payment request failed: ' + JSON.stringify(data));
            }

            if (data.approved || data.status === "Pending" || data.status === "Authorized") {
                klarnaStatus.innerHTML = 'Klarna payment successful!';
                setTimeout(() => {
                    window.location.href = '/success';
                }, 1000);
            } else {
                throw new Error('Klarna payment not authorized');
            }
        } catch (error) {
            klarnaStatus.innerHTML = 'Error: ' + error.message;
            klarnaPayButton.disabled = false;
        }
    }

    // iDEAL LOGIC
    idealPayButton.addEventListener('click', handleIdealPayment);

    async function handleIdealPayment() {
        idealPayButton.disabled = true;
        idealStatus.innerHTML = 'Processing iDEAL payment...';

        try {
            const response = await fetch('/api/ideal-payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error('iDEAL payment request failed: ' + errorText);
            }

            const data = await response.json();
            if (data.redirectUrl) {
                idealStatus.innerHTML = 'Redirecting to iDEAL...';
                window.location.href = data.redirectUrl;
            } else {
                throw new Error('No redirect URL for iDEAL payment');
            }
        } catch (error) {
            idealStatus.innerHTML = 'Error: ' + error.message;
            idealPayButton.disabled = false;
        }
    }
});
