class Payment {
    constructor() {
        this.paymentForm = document.getElementById('payment-form');
        this.payButton = document.querySelector('.pay-btn');
        this.orderItems = document.getElementById('order-items');
        this.paymentTotal = document.getElementById('payment-total');
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.user = JSON.parse(localStorage.getItem('currentUser'));

        this.initializeEventListeners();
        this.displayOrderSummary();
        this.checkNotifications(); // Check for notifications on load
        this.checkServerStatus().then(isServerUp => {
            if (isServerUp) {
                this.checkPendingExpiryNotifications(); // Check for pending expiry notifications
            }
        });
        this.displayScheduledNotifications(); // Display scheduled notifications
    }

    initializeEventListeners() {
        this.paymentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePayment();
        });

        this.payButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.handlePayment();
        });

        // Card number formatting
        const cardNumber = document.getElementById('card-number');
        cardNumber.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/(\d{4})/g, '$1 ').trim();
            e.target.value = value;
        });

        // Expiry date formatting
        const expiry = document.getElementById('expiry');
        expiry.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2);
            }
            e.target.value = value;
        });

        // CVV validation
        const cvv = document.getElementById('cvv');
        cvv.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
        });
    }

    displayOrderSummary() {
        this.orderItems.innerHTML = '';
        let total = 0;

        this.cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const orderItem = document.createElement('div');
            orderItem.className = 'order-item';
            orderItem.innerHTML = `
                <div class="order-item-details">
                    <span class="name">${item.name}</span>
                    <span class="quantity">Quantity: ${item.quantity}</span>
                    <span class="expiry">Expires: ${this.formatDate(item.expiryDate)}</span>
                </div>
                <span class="price">₹${itemTotal.toFixed(2)}</span>
            `;
            this.orderItems.appendChild(orderItem);
        });

        this.paymentTotal.textContent = `₹${total.toFixed(2)}`;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    generateOrderId() {
        const timestamp = new Date().getTime();
        const random = Math.floor(Math.random() * 1000);
        return `ORD-${timestamp}-${random}`;
    }

    handlePayment() {
        console.log('Payment process started');
        
        const cardNumber = document.getElementById('card-number').value.replace(/\s/g, '');
        const expiry = document.getElementById('expiry').value;
        const cvv = document.getElementById('cvv').value;
        const cardName = document.getElementById('card-name').value;

        // Basic validation
        if (cardNumber.length !== 16 || expiry.length !== 5 || cvv.length !== 3 || !cardName) {
            this.showNotification('Please fill in all payment details correctly', 'error');
            return;
        }

        // Generate order ID
        const orderId = this.generateOrderId();
        console.log('Generated Order ID:', orderId);

        // Create order object
        const order = {
            id: orderId,
            userId: this.user.id,
            items: this.cart,
            total: this.calculateTotal(),
            date: new Date().toISOString(),
            status: 'completed'
        };

        // Save order to localStorage
        const orders = JSON.parse(localStorage.getItem('orders')) || [];
        orders.push(order);
        localStorage.setItem('orders', JSON.stringify(orders));
        console.log('Order saved:', order);

        // Send order confirmation notification
        this.sendOrderConfirmationNotification(order);

        // Schedule expiry notifications for each item
        this.scheduleExpiryNotifications(order);

        // Clear cart
        localStorage.removeItem('cart');
        this.cart = [];

        // Show success message
        this.showNotification(`Payment successful! Order ID: ${orderId}`, 'success');

        // Redirect to products page after 2 seconds
        setTimeout(() => {
            window.location.href = 'products.html';
        }, 2000);
    }

    calculateTotal() {
        return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    sendOrderConfirmationNotification(order) {
        // Send email via our server
        fetch('http://localhost:3001/send-order-confirmation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userEmail: this.user.email,
                userName: this.user.name,
                orderId: order.id,
                items: order.items,
                total: order.total,
                date: order.date
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showNotification('Order confirmation email sent!', 'success');
            } else {
                this.showNotification('Failed to send order confirmation email', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            this.showNotification('Failed to send order confirmation email', 'error');
        });

        // Also save notification locally
        const notification = {
            type: 'order_confirmation',
            userId: this.user.id,
            orderId: order.id,
            message: `Order Confirmation - Order ID: ${order.id}
                     Total Amount: ₹${order.total.toFixed(2)}
                     Items:
                     ${order.items.map(item => `${item.name} (Qty: ${item.quantity})`).join('\n')}`,
            date: new Date().toISOString(),
            status: 'unread'
        };

        this.saveNotification(notification);
    }

    scheduleExpiryNotifications(order, testMode = false) {
        console.log('Scheduling expiry notifications for order:', order.id);
        
        order.items.forEach(item => {
            const expiryDate = new Date(item.expiryDate);
            const notificationDate = new Date(expiryDate);
            notificationDate.setDate(notificationDate.getDate() - 2); // 2 days before expiry

            // For testing, we can send notifications immediately
            const delay = testMode ? 5000 : notificationDate.getTime() - new Date().getTime();
            
            if (delay > 0 || testMode) {
                console.log(`Scheduling notification for ${item.name} to be sent on ${this.formatDate(notificationDate)}`);
                if (testMode) {
                    console.log('TEST MODE: Notification will be sent in 5 seconds');
                }
                
                // Store the scheduled notification in localStorage
                const scheduledNotifications = JSON.parse(localStorage.getItem('scheduledNotifications')) || [];
                const notification = {
                    orderId: order.id,
                    itemName: item.name,
                    expiryDate: item.expiryDate,
                    notificationDate: testMode ? new Date().toISOString() : notificationDate.toISOString(),
                    userEmail: this.user.email,
                    userName: this.user.name,
                    status: 'scheduled'
                };
                scheduledNotifications.push(notification);
                localStorage.setItem('scheduledNotifications', JSON.stringify(scheduledNotifications));

                // Schedule the email notification with retry logic
                const sendNotification = (retryCount = 0) => {
                    console.log(`Sending expiry notification for ${item.name} from order ${order.id}`);
                    fetch('http://localhost:3001/send-expiry-notification', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            userEmail: this.user.email,
                            userName: this.user.name,
                            itemName: item.name,
                            expiryDate: item.expiryDate,
                            orderId: order.id
                        })
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.success) {
                            console.log(`Expiry notification sent successfully for ${item.name}`, data);
                            // Update notification status in localStorage
                            const notifications = JSON.parse(localStorage.getItem('scheduledNotifications')) || [];
                            const updatedNotifications = notifications.map(n => {
                                if (n.orderId === order.id && n.itemName === item.name) {
                                    return { ...n, status: 'sent' };
                                }
                                return n;
                            });
                            localStorage.setItem('scheduledNotifications', JSON.stringify(updatedNotifications));
                            this.showNotification(`Expiry notification sent for ${item.name}`, 'success');
                        } else {
                            throw new Error(data.message || 'Failed to send notification');
                        }
                    })
                    .catch(error => {
                        console.error(`Error sending expiry notification for ${item.name}:`, error);
                        if (retryCount < 3) {  // Retry up to 3 times
                            console.log(`Retrying... (Attempt ${retryCount + 1} of 3)`);
                            setTimeout(() => sendNotification(retryCount + 1), 2000 * (retryCount + 1));
                        } else {
                            this.showNotification(`Failed to send expiry notification for ${item.name}`, 'error');
                        }
                    });
                };

                setTimeout(() => sendNotification(), delay);
            }
        });
    }

    saveNotification(notification) {
        const notifications = JSON.parse(localStorage.getItem('notifications')) || [];
        notifications.push(notification);
        localStorage.setItem('notifications', JSON.stringify(notifications));
        console.log('Notification saved:', notification);
    }

    checkNotifications() {
        const notifications = JSON.parse(localStorage.getItem('notifications')) || [];
        const now = new Date();

        notifications.forEach(notification => {
            if (notification.status === 'scheduled' && new Date(notification.scheduledFor) <= now) {
                notification.status = 'unread';
                this.showNotification(notification.message, 'info');
            }
        });

        localStorage.setItem('notifications', JSON.stringify(notifications));
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    testNotificationSystem() {
        if (!this.user) {
            this.showNotification("Please log in first", "error");
            console.error("User not logged in");
            return;
        }

        // Create test dates that are closer to the current date
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const dayAfterTomorrow = new Date(now);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

        // Test order confirmation notification
        const testOrder = {
            id: "TEST-" + Date.now(),
            userId: this.user.id,
            items: [
                {
                    name: "Test Product 1",
                    quantity: 2,
                    price: 99.99,
                    expiryDate: tomorrow.toISOString() // Expires tomorrow
                },
                {
                    name: "Test Product 2",
                    quantity: 1,
                    price: 49.99,
                    expiryDate: dayAfterTomorrow.toISOString() // Expires day after tomorrow
                }
            ],
            total: 249.97,
            date: now.toISOString()
        };

        console.log('Creating test order with items expiring on:');
        console.log('- ' + testOrder.items[0].name + ': ' + this.formatDate(testOrder.items[0].expiryDate));
        console.log('- ' + testOrder.items[1].name + ': ' + this.formatDate(testOrder.items[1].expiryDate));

        this.sendOrderConfirmationNotification(testOrder);
        this.scheduleExpiryNotifications(testOrder, true); // Use test mode for immediate notifications
        this.showNotification("Test notifications created! Check your email and the notifications panel.", 'success');
    }

    checkPendingExpiryNotifications() {
        console.log('Checking pending expiry notifications...');
        const scheduledNotifications = JSON.parse(localStorage.getItem('scheduledNotifications')) || [];
        const now = new Date();

        scheduledNotifications.forEach(notification => {
            if (notification.status === 'scheduled') {
                const notificationDate = new Date(notification.notificationDate);
                if (notificationDate <= now) {
                    console.log(`Sending pending notification for ${notification.itemName} from order ${notification.orderId}`);
                    
                    // Add retry logic for failed notifications
                    const sendNotification = (retryCount = 0) => {
                        fetch('http://localhost:3001/send-expiry-notification', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                userEmail: notification.userEmail,
                                userName: notification.userName,
                                itemName: notification.itemName,
                                expiryDate: notification.expiryDate,
                                orderId: notification.orderId
                            })
                        })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then(data => {
                            if (data.success) {
                                console.log(`Pending notification sent successfully for ${notification.itemName}`);
                                notification.status = 'sent';
                                localStorage.setItem('scheduledNotifications', JSON.stringify(scheduledNotifications));
                                this.showNotification(`Expiry notification sent for ${notification.itemName}`, 'success');
                            } else {
                                throw new Error(data.error || 'Failed to send notification');
                            }
                        })
                        .catch(error => {
                            console.error('Error sending pending notification:', error);
                            if (retryCount < 3) {
                                console.log(`Retrying notification for ${notification.itemName} (attempt ${retryCount + 1})`);
                                setTimeout(() => sendNotification(retryCount + 1), 5000); // Retry after 5 seconds
                            } else {
                                this.showNotification(`Failed to send expiry notification for ${notification.itemName} after 3 attempts`, 'error');
                            }
                        });
                    };

                    sendNotification();
                }
            }
        });
    }

    // Add a method to check server status
    async checkServerStatus() {
        try {
            const response = await fetch('http://localhost:3001/test-email');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Server status check failed:', error);
            this.showNotification('Server connection failed. Please try again later.', 'error');
            return false;
        }
    }

    displayScheduledNotifications() {
        const scheduledNotifications = JSON.parse(localStorage.getItem('scheduledNotifications')) || [];
        const notificationsContainer = document.createElement('div');
        notificationsContainer.className = 'scheduled-notifications';
        notificationsContainer.innerHTML = `
            <h3>Scheduled Expiry Notifications</h3>
            <div class="notifications-list">
                ${scheduledNotifications.map(notification => `
                    <div class="notification-item ${notification.status}">
                        <div class="notification-header">
                            <span class="order-id">Order #${notification.orderId}</span>
                            <span class="status">${notification.status}</span>
                        </div>
                        <div class="notification-content">
                            <p><strong>Item:</strong> ${notification.itemName}</p>
                            <p><strong>Expiry Date:</strong> ${new Date(notification.expiryDate).toLocaleDateString()}</p>
                            <p><strong>Notification Date:</strong> ${new Date(notification.notificationDate).toLocaleDateString()}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Add styles for notifications
        const style = document.createElement('style');
        style.textContent = `
            .scheduled-notifications {
                margin-top: 20px;
                padding: 20px;
                background-color: #f9f9f9;
                border-radius: 5px;
            }
            .notifications-list {
                max-height: 300px;
                overflow-y: auto;
            }
            .notification-item {
                background-color: white;
                padding: 15px;
                margin-bottom: 10px;
                border-radius: 5px;
                border: 1px solid #ddd;
            }
            .notification-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
            }
            .order-id {
                font-weight: bold;
                color: #4CAF50;
            }
            .status {
                padding: 3px 8px;
                border-radius: 3px;
                font-size: 0.8em;
            }
            .status.scheduled {
                background-color: #fff3e0;
                color: #ff9800;
            }
            .status.sent {
                background-color: #e8f5e9;
                color: #4CAF50;
            }
            .notification-content p {
                margin: 5px 0;
            }
        `;
        document.head.appendChild(style);

        // Add the notifications container after the payment form
        const paymentForm = document.getElementById('payment-form');
        paymentForm.parentNode.insertBefore(notificationsContainer, paymentForm.nextSibling);
    }
}

// Initialize payment page
document.addEventListener('DOMContentLoaded', () => {
    new Payment();
}); 