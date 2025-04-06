require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Verify environment variables
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('Missing required environment variables. Please check your .env file');
    process.exit(1);
}

// Create email transporter with detailed logging
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    },
    debug: true, // Enable debug logs
    logger: true,  // Enable logger
    tls: {
        rejectUnauthorized: false
    },
    pool: true, // Use pooled connections
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000, // How many messages per second
    rateLimit: 5 // Max number of messages per rateDelta
});

// Verify transporter configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('Transporter verification failed:', error);
        console.error('Error code:', error.code);
        console.error('Error command:', error.command);
        console.error('Error response:', error.response);
        console.error('Error responseCode:', error.responseCode);
        console.error('Email configuration:', {
            user: process.env.GMAIL_USER,
            passLength: process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0
        });
    } else {
        console.log('Server is ready to send emails');
        console.log('Using email:', process.env.GMAIL_USER);
    }
});

// Send order confirmation email
app.post('/send-order-confirmation', async (req, res) => {
    console.log('Received order confirmation request:', req.body);
    const { userEmail, userName, orderId, items, total, date } = req.body;

    if (!userEmail || !userName || !orderId || !items || !total || !date) {
        console.error('Missing required fields:', { userEmail, userName, orderId, items, total, date });
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields',
            received: { userEmail, userName, orderId, items, total, date }
        });
    }

    const mailOptions = {
        from: {
            name: 'Grocery Expiration Alert',
            address: process.env.GMAIL_USER
        },
        to: userEmail,
        subject: `Order Confirmation - Order #${orderId}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Order Confirmation</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background-color: #4CAF50;
                        color: white;
                        padding: 20px;
                        text-align: center;
                        border-radius: 5px 5px 0 0;
                    }
                    .content {
                        background-color: #f9f9f9;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 0 0 5px 5px;
                    }
                    .order-info {
                        background-color: #fff;
                        padding: 15px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                    .item {
                        border-bottom: 1px solid #eee;
                        padding: 10px 0;
                    }
                    .total {
                        font-weight: bold;
                        text-align: right;
                        margin-top: 20px;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        font-size: 0.9em;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Order Confirmation</h2>
                </div>
                <div class="content">
                    <p>Dear ${userName},</p>
                    <p>Thank you for your order. Here are your order details:</p>
                    
                    <div class="order-info">
                        <h3>Order Information:</h3>
                        <p><strong>Order ID:</strong> ${orderId}</p>
                        <p><strong>Order Date:</strong> ${new Date(date).toLocaleDateString()}</p>
                        
                        <h3>Items Ordered:</h3>
                        ${items.map(item => `
                            <div class="item">
                                <p><strong>${item.name}</strong></p>
                                <p>Quantity: ${item.quantity}</p>
                                <p>Price: ₹${item.price}</p>
                                <p>Expires: ${new Date(item.expiryDate).toLocaleDateString()}</p>
                            </div>
                        `).join('')}
                        
                        <div class="total">
                            <p>Total Amount: ₹${total}</p>
                        </div>
                    </div>
                    
                    <p>You will receive expiry notifications 2 days before any item expires.</p>
                    
                    <div class="footer">
                        <p>Thank you for shopping with us!</p>
                        <p>Best regards,<br>Grocery Expiration Alert Team</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        console.log('Attempting to send order confirmation email to:', userEmail);
        const info = await transporter.sendMail(mailOptions);
        console.log('Order confirmation email sent successfully:', info.response);
        res.json({ success: true, message: 'Order confirmation email sent' });
    } catch (error) {
        console.error('Error sending order confirmation email:', error);
        console.error('Error details:', {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode
        });
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send email',
            error: error.message,
            details: {
                code: error.code,
                command: error.command,
                response: error.response
            }
        });
    }
});

// Send expiry notification email
app.post('/send-expiry-notification', async (req, res) => {
    console.log('Received expiry notification request:', req.body);
    const { userEmail, userName, itemName, expiryDate, orderId } = req.body;

    if (!userEmail || !userName || !itemName || !expiryDate || !orderId) {
        console.error('Missing required fields:', { userEmail, userName, itemName, expiryDate, orderId });
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields',
            received: { userEmail, userName, itemName, expiryDate, orderId }
        });
    }

    const mailOptions = {
        from: {
            name: 'Grocery Expiration Alert',
            address: process.env.GMAIL_USER
        },
        to: userEmail,
        subject: `Product Expiry Alert - ${itemName}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Product Expiry Alert</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background-color: #ff9800;
                        color: white;
                        padding: 20px;
                        text-align: center;
                        border-radius: 5px 5px 0 0;
                    }
                    .content {
                        background-color: #f9f9f9;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 0 0 5px 5px;
                    }
                    .alert-box {
                        background-color: #fff3e0;
                        padding: 15px;
                        border: 2px solid #ff9800;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        font-size: 0.9em;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>⚠️ Product Expiry Alert</h2>
                </div>
                <div class="content">
                    <p>Dear ${userName},</p>
                    <p>This is a reminder about a product that will expire soon:</p>
                    
                    <div class="alert-box">
                        <h3>Product Details:</h3>
                        <p><strong>Item:</strong> ${itemName}</p>
                        <p><strong>Expiry Date:</strong> ${new Date(expiryDate).toLocaleDateString()}</p>
                        <p><strong>Order ID:</strong> ${orderId}</p>
                    </div>
                    
                    <p>Please consume this item before it expires to avoid food waste.</p>
                    
                    <div class="footer">
                        <p>Thank you for using our service!</p>
                        <p>Best regards,<br>Grocery Expiration Alert Team</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        console.log('Attempting to send expiry notification email to:', userEmail);
        const info = await transporter.sendMail(mailOptions);
        console.log('Expiry notification email sent successfully:', info.response);
        res.json({ 
            success: true, 
            message: 'Expiry notification email sent',
            info: {
                messageId: info.messageId,
                response: info.response
            }
        });
    } catch (error) {
        console.error('Error sending expiry notification email:', error);
        console.error('Error details:', {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode
        });
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send expiry notification email',
            error: error.message,
            details: {
                code: error.code,
                command: error.command,
                response: error.response
            }
        });
    }
});

// Test endpoint with detailed error handling
app.get('/test-email', async (req, res) => {
    try {
        console.log('Attempting to send test email...');
        console.log('Using email:', process.env.GMAIL_USER);
        console.log('App Password length:', process.env.GMAIL_APP_PASSWORD.length);

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            subject: 'Test Email from Grocery Alert System',
            text: 'This is a test email to verify the email configuration.'
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
        res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
        console.error('Failed to send test email:', error);
        console.error('Error code:', error.code);
        console.error('Error command:', error.command);
        console.error('Error response:', error.response);
        console.error('Error responseCode:', error.responseCode);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: {
                code: error.code,
                command: error.command,
                response: error.response
            }
        });
    }
});

const PORT = process.env.PORT || 3000;

// Function to start server
const startServer = async (port) => {
    try {
        await new Promise((resolve, reject) => {
            const server = app.listen(port, () => {
                console.log(`Server running on port ${port}`);
                resolve();
            });

            server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.log(`Port ${port} is busy, trying ${port + 1}...`);
                    server.close();
                    startServer(port + 1);
                } else {
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer(PORT); 