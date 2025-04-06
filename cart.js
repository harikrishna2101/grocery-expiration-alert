class CartManager {
    constructor() {
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.setupEventListeners();
        this.displayCart();
        this.quantityUpdateTimeout = null;
    }

    setupEventListeners() {
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => this.handleCheckout());
        }
    }

    displayCart() {
        const cartItems = document.getElementById('cart-items');
        const cartTotal = document.getElementById('cart-total');
        if (!cartItems || !cartTotal) return;

        if (this.cart.length === 0) {
            cartItems.innerHTML = '<p>Your cart is empty</p>';
            cartTotal.textContent = '₹0.00';
            return;
        }

        cartItems.innerHTML = this.cart.map(item => `
            <div class="cart-item">
                <div class="item-details">
                    <h3>${item.name}</h3>
                    <p class="item-price">₹${item.price.toFixed(2)} x ${item.quantity}</p>
                    <p class="item-subtotal">Subtotal: ₹${(item.price * item.quantity).toFixed(2)}</p>
                    <p class="expiry">Expires: ${new Date(item.expiryDate).toLocaleDateString()}</p>
                </div>
                <div class="item-actions">
                    <div class="quantity-controls">
                        <button class="quantity-btn minus-btn" data-id="${item.id}" data-action="decrease" 
                            ${item.quantity <= 1 ? 'disabled' : ''}>
                            <span class="btn-icon">−</span>
                        </button>
                        <div class="quantity-wrapper">
                            <input type="number" class="quantity-input" value="${item.quantity}" 
                                min="1" max="10" data-id="${item.id}" 
                                ${item.quantity >= 10 ? 'disabled' : ''}>
                        </div>
                        <button class="quantity-btn plus-btn" data-id="${item.id}" data-action="increase" 
                            ${item.quantity >= 10 ? 'disabled' : ''}>
                            <span class="btn-icon">+</span>
                        </button>
                    </div>
                    <button class="remove-btn" data-id="${item.id}">
                        <span class="remove-icon">×</span> Remove
                    </button>
                </div>
            </div>
        `).join('');

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotal.textContent = `₹${total.toFixed(2)}`;

        this.setupCartItemListeners();
    }

    setupCartItemListeners() {
        const cartItems = document.getElementById('cart-items');
        if (!cartItems) return;

        cartItems.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button || !button.dataset.id) return;
            
            const productId = parseInt(button.dataset.id);
            
            if (button.classList.contains('quantity-btn')) {
                const action = button.dataset.action;
                if (button.disabled) {
                    this.showQuantityLimitMessage(action);
                    return;
                }
                this.updateQuantity(productId, action);
                this.animateButton(button);
            } else if (button.classList.contains('remove-btn')) {
                this.removeItemWithAnimation(productId);
            }
        });

        // Add input event listener for quantity inputs
        cartItems.addEventListener('input', (e) => {
            if (e.target.classList.contains('quantity-input')) {
                const productId = parseInt(e.target.dataset.id);
                let value = parseInt(e.target.value);

                // Clear any existing timeout
                if (this.quantityUpdateTimeout) {
                    clearTimeout(this.quantityUpdateTimeout);
                }

                // Validate input
                if (isNaN(value) || value < 1) {
                    value = 1;
                } else if (value > 10) {
                    value = 10;
                }

                // Update after a short delay
                this.quantityUpdateTimeout = setTimeout(() => {
                    this.updateQuantityDirectly(productId, value);
                }, 500);
            }
        });
    }

    showQuantityLimitMessage(action) {
        const message = action === 'decrease' ? 
            'Minimum quantity is 1' : 
            'Maximum quantity is 10';
        this.showNotification(message, 'error');
    }

    animateButton(button) {
        button.classList.add('clicked');
        setTimeout(() => button.classList.remove('clicked'), 200);
    }

    updateQuantityDirectly(productId, newQuantity) {
        const item = this.cart.find(item => item.id === productId);
        if (!item) return;

        if (newQuantity === item.quantity) return;

        if (newQuantity >= 1 && newQuantity <= 10) {
            item.quantity = newQuantity;
            localStorage.setItem('cart', JSON.stringify(this.cart));
            this.displayCart();
            productManager.updateCartCount();
            this.showNotification(`Quantity updated to ${newQuantity}`);
        } else {
            this.showNotification('Quantity must be between 1 and 10', 'error');
            this.displayCart(); // Reset display to valid value
        }
    }

    updateQuantity(productId, action) {
        const item = this.cart.find(item => item.id === productId);
        if (!item) return;

        let newQuantity = item.quantity;
        
        if (action === 'increase') {
            if (newQuantity < 10) {
                newQuantity += 1;
                this.showNotification(`Quantity updated to ${newQuantity}`);
            } else {
                this.showQuantityLimitMessage('increase');
                return;
            }
        } else if (action === 'decrease') {
            if (newQuantity > 1) {
                newQuantity -= 1;
                this.showNotification(`Quantity updated to ${newQuantity}`);
            } else {
                this.showQuantityLimitMessage('decrease');
                return;
            }
        }

        item.quantity = newQuantity;
        localStorage.setItem('cart', JSON.stringify(this.cart));
        this.displayCart();
        productManager.updateCartCount();
    }

    removeItemWithAnimation(productId) {
        const itemElement = document.querySelector(`.cart-item button[data-id="${productId}"]`).closest('.cart-item');
        itemElement.classList.add('removing');
        
        setTimeout(() => {
            this.removeItem(productId);
        }, 300);
    }

    removeItem(productId) {
        const item = this.cart.find(item => item.id === productId);
        if (item) {
            this.cart = this.cart.filter(item => item.id !== productId);
            localStorage.setItem('cart', JSON.stringify(this.cart));
            this.displayCart();
            productManager.updateCartCount();
            this.showNotification(`${item.name} removed from cart`);
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 2700);
    }

    handleCheckout() {
        if (!auth.isAuthenticated()) {
            this.showNotification('Please login to checkout', 'error');
            window.location.href = 'index.html';
            return;
        }

        if (this.cart.length === 0) {
            this.showNotification('Your cart is empty', 'error');
            return;
        }

        window.location.href = 'payment.html';
    }
}

const cartManager = new CartManager(); 