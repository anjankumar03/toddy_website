// ===== CONFIGURATION =====
const prices = {eetha: 60, thati: 75, neera: 90};
let deliveryCharge = 0;

// ===== INVENTORY MANAGEMENT =====
function getInventory() {
    const defaultInventory = {eetha: 50, thati: 50, neera: 50};
    return JSON.parse(localStorage.getItem('toddyInventory') || JSON.stringify(defaultInventory));
}

function updateInventory(type, quantity) {
    const inventory = getInventory();
    inventory[type] = Math.max(0, inventory[type] - quantity);
    localStorage.setItem('toddyInventory', JSON.stringify(inventory));
}

function checkAvailability(type, quantity) {
    const inventory = getInventory();
    return inventory[type] >= quantity;
}

// ===== UPI PAYMENT CONFIGURATION =====
const UPI_ID = "6302564464@pthdfc"; // CHANGE TO YOUR ACTUAL UPI ID
const MERCHANT_NAME = "Nagula Shiva Sai"; // CHANGE TO YOUR SHOP NAME

// ===== YOUR SHOP LOCATION (PRECISE COORDINATES FOR SANDRALAPALLY) =====
const shopLat = 18.432; // More precise latitude for Sandralapally area
const shopLng = 78.474; // More precise longitude for Sandralapally area
const shopAddress = "JVRF+996 Kallu manduva kodimial, Sandralapally X Rd, Sandralapally, Telangana 505501"; // Your actual shop address

// ===== GLOBAL VARIABLES =====
let map;
let marker;
let customerLat = null;
let customerLng = null;

// ===== LANGUAGE TOGGLE =====
function setLang(l) {
    document.querySelectorAll('[data-en]').forEach(e => 
        e.innerText = e.getAttribute('data-' + l)
    );
}

// ===== VALIDATION FUNCTIONS =====
function validateCustomerName() {
    const name = document.getElementById('customerName').value.trim();
    const error = document.getElementById('nameError');
    
    if (!name) {
        error.textContent = 'Name is required';
        return false;
    }
    if (name.length < 2) {
        error.textContent = 'Name must be at least 2 characters';
        return false;
    }
    error.textContent = '';
    return true;
}

function validateMobileNumber() {
    const mobile = document.getElementById('mobileNumber').value.trim();
    const error = document.getElementById('mobileError');
    
    if (!mobile) {
        error.textContent = 'Mobile number is required';
        return false;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
        error.textContent = 'Enter valid 10-digit mobile number';
        return false;
    }
    error.textContent = '';
    return true;
}

function validateLocation() {
    const error = document.getElementById('locationError');
    
    if (deliveryOption.value === 'delivery' && (!customerLat || !customerLng)) {
        error.textContent = 'Please select delivery location';
        return false;
    }
    error.textContent = '';
    return true;
}

// ===== DELIVERY TOGGLE =====
function toggleDelivery() {
    const deliverySection = document.getElementById('deliverySection');
    const isDelivery = deliveryOption.value === 'delivery';
    
    deliverySection.classList.toggle('hidden', !isDelivery);
    
    if (!isDelivery) {
        // Reset delivery charge for pickup
        deliveryCharge = 0;
        customerLat = null;
        customerLng = null;
        document.getElementById('address').value = '';
        document.getElementById('mapContainer').classList.add('hidden');
    }
    
    calculateTotal();
}

// ===== AUTOMATIC GPS LOCATION FETCHING =====
function getCurrentLocation() {
    const btn = document.getElementById('useLocationBtn');
    const addressField = document.getElementById('address');
    
    // Show loading state
    btn.textContent = 'Fetching your location...';
    btn.disabled = true;
    
    // Set temporary placeholder to prevent jumping
    if (!addressField.value.trim()) {
        addressField.placeholder = 'Getting your location...';
    }
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
        showLocationError('Geolocation is not supported by this browser');
        resetLocationButton();
        return;
    }
    
    // Request user's current position
    navigator.geolocation.getCurrentPosition(
        // Success callback - GPS location found
        (position) => {
            customerLat = position.coords.latitude;
            customerLng = position.coords.longitude;
            
            console.log('GPS Location found:', customerLat, customerLng);
            
            // Convert coordinates to readable address
            reverseGeocode(customerLat, customerLng);
            
            // Show map with both shop and customer location
            document.getElementById('mapContainer').classList.remove('hidden');
            initMap();
            
            // Update button state
            btn.textContent = '✅ Location Found';
            btn.disabled = false;
            
            // Reset placeholder
            addressField.placeholder = 'Your address will appear here';
            
            // Calculate delivery charges automatically
            calculateDeliveryCharge();
        },
        // Error callback - GPS failed
        (error) => {
            console.error('Geolocation error:', error);
            
            let errorMessage;
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Please allow location access to use this feature';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information is unavailable';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out';
                    break;
                default:
                    errorMessage = 'An unknown error occurred while fetching location';
                    break;
            }
            
            showLocationError(errorMessage);
            resetLocationButton();
            
            // Reset placeholder
            addressField.placeholder = 'Type your full delivery address (area, landmark, city)';
        },
        // Options for high accuracy
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000
        }
    );
}

// ===== REVERSE GEOCODING - CONVERT COORDINATES TO ADDRESS =====
function reverseGeocode(lat, lng) {
    // Use Nominatim (OpenStreetMap's free reverse geocoding service)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.display_name) {
                // Only update address if field is empty or contains coordinates
                const addressField = document.getElementById('address');
                const currentValue = addressField.value.trim();
                
                // Don't overwrite if user has manually entered an address
                if (!currentValue || currentValue.includes('Lat:') || currentValue.includes('Getting location')) {
                    addressField.value = data.display_name;
                    console.log('Address auto-filled:', data.display_name);
                } else {
                    console.log('Address not updated - user has custom address');
                }
            } else {
                // Only set coordinates if no address exists
                const addressField = document.getElementById('address');
                if (!addressField.value.trim()) {
                    addressField.value = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
                }
            }
            
            // Update pay button state after address handling
            updatePayButtonState();
        })
        .catch(error => {
            console.error('Reverse geocoding error:', error);
            // Only fallback to coordinates if address field is empty
            const addressField = document.getElementById('address');
            if (!addressField.value.trim()) {
                addressField.value = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
            }
            updatePayButtonState();
        });
}

// ===== FIND EXACT SHOP COORDINATES (FOR DEBUGGING) =====
function findShopLocation() {
    const shopAddressForSearch = "Sandralapally X Rd, Sandralapally, Telangana 505501, India";
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(shopAddressForSearch)}&limit=1`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const foundLat = parseFloat(data[0].lat);
                const foundLng = parseFloat(data[0].lon);
                console.log('FOUND SHOP COORDINATES:');
                console.log('Latitude:', foundLat);
                console.log('Longitude:', foundLng);
                console.log('Address:', data[0].display_name);
                console.log('UPDATE YOUR CODE WITH THESE COORDINATES:');
                console.log(`const shopLat = ${foundLat};`);
                console.log(`const shopLng = ${foundLng};`);
            } else {
                console.log('Shop location not found in search');
            }
        })
        .catch(error => {
            console.error('Error finding shop location:', error);
        });
}

// Call this function to find exact coordinates
findShopLocation();

// ===== SEARCH ADDRESS AND SET LOCATION =====
function searchAddress() {
    const address = document.getElementById('address').value.trim();
    
    if (!address) {
        alert('Please enter your delivery address');
        return;
    }
    
    // Store the original address to prevent overwriting
    const originalAddress = address;
    
    // Use Nominatim to convert address to coordinates
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                customerLat = parseFloat(data[0].lat);
                customerLng = parseFloat(data[0].lon);
                
                // Keep the user's original address, don't overwrite with API response
                document.getElementById('address').value = originalAddress;
                
                // Show map
                document.getElementById('mapContainer').classList.remove('hidden');
                initMap();
                
                alert('Location found! You can drag the marker to adjust if needed.');
            } else {
                alert('Address not found. Please try a different address or be more specific.');
            }
        })
        .catch(error => {
            console.error('Geocoding error:', error);
            alert('Error finding address. Please try again.');
        });
}

// ===== LEAFLET MAP INTEGRATION =====
function initMap() {
    if (!customerLat || !customerLng) return;
    
    // Clear existing map if it exists
    if (map) {
        map.remove();
    }
    
    // Create map centered between shop and customer location
    const centerLat = (shopLat + customerLat) / 2;
    const centerLng = (shopLng + customerLng) / 2;
    
    map = L.map('map').setView([centerLat, centerLng], 13);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add shop marker (red)
    const shopMarker = L.marker([shopLat, shopLng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map).bindPopup('Toddy Shop').openPopup();
    
    // Add customer marker (blue, draggable for fine-tuning)
    marker = L.marker([customerLat, customerLng], {
        draggable: true,
        title: 'Your delivery location (drag to adjust if needed)'
    }).addTo(map).bindPopup('Your Location');
    
    // Update when marker is dragged (for fine-tuning)
    marker.on('dragend', function() {
        const position = marker.getLatLng();
        customerLat = position.lat;
        customerLng = position.lng;
        
        // Update address when manually adjusted
        reverseGeocode(customerLat, customerLng);
        calculateDeliveryCharge();
    });
    
    // Fit map to show both markers
    const group = new L.featureGroup([shopMarker, marker]);
    map.fitBounds(group.getBounds().pad(0.1));
}

// ===== ADDRESS GEOCODING (FREE USING NOMINATIM) =====
function updateAddressFromCoords(lat, lng) {
    // Use Nominatim (OpenStreetMap's free geocoding service)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.display_name) {
                document.getElementById('address').value = data.display_name;
            } else {
                document.getElementById('address').value = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
            }
        })
        .catch(error => {
            console.error('Geocoding error:', error);
            document.getElementById('address').value = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
        });
}

// ===== DISTANCE CALCULATION =====
function calculateDistance(lat1, lng1, lat2, lng2) {
    // Using Haversine formula for distance calculation
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
}

// ===== DELIVERY CHARGE CALCULATION =====
function calculateDeliveryCharge() {
    if (deliveryOption.value !== 'delivery' || !customerLat || !customerLng) {
        deliveryCharge = 0;
        document.getElementById('distanceInfo').textContent = '';
        document.getElementById('deliveryChargeInfo').textContent = '';
        calculateTotal();
        return;
    }
    
    // Calculate distance from shop to customer
    const distance = calculateDistance(shopLat, shopLng, customerLat, customerLng);
    
    // Calculate delivery charge: ₹30 for first 3km, ₹10 per extra km
    if (distance <= 3) {
        deliveryCharge = 30;
    } else {
        const extraKm = Math.ceil(distance - 3);
        deliveryCharge = 30 + (extraKm * 10);
    }
    
    // Update UI with distance and delivery charge
    document.getElementById('distanceInfo').textContent = 
        `Distance: ${distance.toFixed(1)} km from shop`;
    document.getElementById('deliveryChargeInfo').textContent = 
        `Delivery Charge: ₹${deliveryCharge}`;
    
    // Recalculate total amount
    calculateTotal();
    
    console.log(`Distance: ${distance.toFixed(1)}km, Delivery: ₹${deliveryCharge}`);
}

// ===== INVENTORY DISPLAY AND VALIDATION =====
function updateAvailabilityAndCalculate() {
    const type = toddyType.value;
    const inventory = getInventory();
    const available = inventory[type];
    
    document.getElementById('availabilityInfo').textContent = `Available: ${available}L`;
    
    // Update max attribute for quantity input
    const litresInput = document.getElementById('litres');
    litresInput.max = available;
    
    // Validate current quantity
    validateQuantityAndCalculate();
}

function validateQuantityAndCalculate() {
    const type = toddyType.value;
    const quantity = parseInt(document.getElementById('litres').value);
    const inventory = getInventory();
    const available = inventory[type];
    const errorDiv = document.getElementById('quantityError');
    
    if (quantity > available) {
        errorDiv.textContent = `Only ${available}L available for ${type.toUpperCase()}`;
        document.getElementById('priceDetails').innerText = 'Total: ₹0';
        document.getElementById('paymentTotal').innerText = 'Total: ₹0';
        updatePayButtonState();
        return false;
    } else {
        errorDiv.textContent = '';
        calculateTotal();
        return true;
    }
}

// ===== PRICE CALCULATION =====
function calculateTotal() {
    const type = toddyType.value;
    const litres = +document.getElementById('litres').value;
    
    if (litres < 1) {
        document.getElementById('priceDetails').innerText = 'Total: ₹0';
        document.getElementById('paymentTotal').innerText = 'Total: ₹0';
        return;
    }
    
    let total = prices[type] * litres;
    
    // Add delivery charge only for delivery option
    if (deliveryOption.value === 'delivery') {
        total += deliveryCharge;
    }
    
    document.getElementById('priceDetails').innerText = `Total: ₹${total}`;
    document.getElementById('paymentTotal').innerText = `Total: ₹${total}`;
    
    // Update pay button state
    updatePayButtonState();
}

// ===== UPDATE PAY BUTTON STATE =====
function updatePayButtonState() {
    const payBtn = document.getElementById('payBtn');
    const isNameValid = document.getElementById('customerName').value.trim().length >= 2;
    const isMobileValid = /^[6-9]\d{9}$/.test(document.getElementById('mobileNumber').value.trim());
    const isDeliveryValid = deliveryOption.value === 'pickup' || 
                           (deliveryOption.value === 'delivery' && document.getElementById('address').value.trim());
    
    const isFormValid = isNameValid && isMobileValid && isDeliveryValid;
    
    payBtn.disabled = !isFormValid;
    payBtn.style.opacity = isFormValid ? '1' : '0.5';
    payBtn.style.cursor = isFormValid ? 'pointer' : 'not-allowed';
}

// ===== GENERATE UPI PAYMENT URL =====
function generateUpiUrl(amount, customerName) {
    const transactionNote = `Toddy Order - ${customerName}`;
    
    // UPI URL format: upi://pay?pa=UPI_ID&pn=MERCHANT_NAME&am=AMOUNT&cu=INR&tn=NOTE
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    
    return upiUrl;
}

// ===== UPI PAYMENT PROCESSING =====
function payNow() {
    // Validate all fields
    const isNameValid = validateCustomerName();
    const isMobileValid = validateMobileNumber();
    
    if (!isNameValid || !isMobileValid) {
        alert('Please fill all required fields correctly');
        return;
    }
    
    // For delivery, check if location is set
    if (deliveryOption.value === 'delivery') {
        const address = document.getElementById('address').value.trim();
        if (!address) {
            alert('Please enter your delivery address');
            return;
        }
    }
    
    // Get order details
    const customerName = document.getElementById('customerName').value.trim();
    const totalAmountText = document.getElementById('paymentTotal').innerText;
    const totalAmount = totalAmountText.replace(/\D/g, '');
    const selectedType = toddyType.value;
    const selectedQuantity = parseInt(document.getElementById('litres').value);
    
    if (!totalAmount || totalAmount === '0') {
        alert('Please select quantity (minimum 1 litre)');
        return;
    }
    
    // Check inventory availability before payment
    if (!checkAvailability(selectedType, selectedQuantity)) {
        alert(`Sorry, only ${getInventory()[selectedType]}L of ${selectedType.toUpperCase()} is available`);
        return;
    }
    
    // Prepare order details for owner (save before payment)
    const orderDetails = prepareOrderForOwner();
    
    // Generate UPI payment URL
    const upiUrl = generateUpiUrl(totalAmount, customerName);
    
    // Show payment confirmation
    const confirmMsg = `You will be redirected to pay ₹${totalAmount} via UPI.\n\nClick OK to proceed with payment.`;
    
    if (confirm(confirmMsg)) {
        // Redirect to UPI app
        window.location.href = upiUrl;
        
        // Redirect to success page after delay
        setTimeout(() => {
            window.location.href = 'order-success.html';
        }, 3000);
    }
}

// ===== PREPARE ORDER DETAILS FOR OWNER =====
function prepareOrderForOwner() {
    const customerName = document.getElementById('customerName').value;
    const mobile = document.getElementById('mobileNumber').value;
    const toddyType = document.getElementById('toddyType').value;
    const litres = document.getElementById('litres').value;
    const deliveryType = deliveryOption.value;
    const address = document.getElementById('address').value;
    const total = document.getElementById('priceDetails').innerText;
    
    // Create comprehensive order data for owner dashboard
    const orderData = {
        id: Date.now().toString(), // Unique order ID
        timestamp: new Date().toLocaleString(),
        customer: customerName,
        mobile: mobile,
        type: toddyType,
        litres: litres,
        total: total,
        deliveryType: deliveryType,
        address: deliveryType === 'delivery' ? address : 'Self Pickup',
        coordinates: (deliveryType === 'delivery' && customerLat && customerLng) ? `${customerLat},${customerLng}` : null,
        mapsLink: (deliveryType === 'delivery' && customerLat && customerLng) ? `https://www.google.com/maps/dir/${shopLat},${shopLng}/${customerLat},${customerLng}` : null,
        status: 'new', // new, delivered
        orderDate: new Date().toISOString(),
        deliveryCharge: deliveryCharge,
        distance: (deliveryType === 'delivery' && customerLat && customerLng) ? calculateDistance(shopLat, shopLng, customerLat, customerLng).toFixed(1) : null
    };
    
    // Save to localStorage for owner access
    let orders = JSON.parse(localStorage.getItem('toddyOrders') || '[]');
    orders.unshift(orderData); // Add to beginning for latest first
    localStorage.setItem('toddyOrders', JSON.stringify(orders));
    
    // Update inventory after successful order
    updateInventory(toddyType, litres);
    
    // Create text summary for notifications
    let orderText = `NEW TODDY ORDER\n\n`;
    orderText += `Customer: ${customerName}\n`;
    orderText += `Mobile: ${mobile}\n`;
    orderText += `Type: ${toddyType.toUpperCase()} - ${litres}L\n`;
    orderText += `${total}\n\n`;
    
    if (deliveryType === 'delivery') {
        orderText += `DELIVERY ORDER\n`;
        orderText += `Address: ${address}\n`;
        
        if (customerLat && customerLng) {
            orderText += `Distance: ${orderData.distance} km from shop\n`;
            orderText += `Delivery Charge: ₹${deliveryCharge}\n\n`;
            orderText += `Navigation: ${orderData.mapsLink}\n`;
        }
    } else {
        orderText += `PICKUP ORDER\n`;
        orderText += `Customer will collect from shop\n`;
    }
    
    console.log('Order saved for owner dashboard:', orderData);
    
    // Show notification with option to view owner dashboard
    setTimeout(() => {
        if (deliveryType === 'delivery' && customerLat && customerLng) {
            const action = confirm('Order placed successfully! 🎉\n\nWould you like to:\n• OK = Open Navigation\n• Cancel = View Owner Dashboard');
            if (action) {
                window.open(orderData.mapsLink, '_blank');
            } else {
                window.open('owner.html', '_blank');
            }
        } else {
            if (confirm('Order placed successfully! 🎉\n\nWould you like to view the Owner Dashboard?')) {
                window.open('owner.html', '_blank');
            }
        }
    }, 1000);
    
    return orderText;
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
    // Add real-time validation
    document.getElementById('customerName').addEventListener('blur', validateCustomerName);
    document.getElementById('customerName').addEventListener('input', updatePayButtonState);
    
    document.getElementById('mobileNumber').addEventListener('blur', validateMobileNumber);
    document.getElementById('mobileNumber').addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '');
        updatePayButtonState();
    });
    
    // Update pay button when delivery option changes
    deliveryOption.addEventListener('change', updatePayButtonState);
    
    // Update pay button when address changes
    document.getElementById('address').addEventListener('input', updatePayButtonState);
    
    // Initial calculation and button state
    updateAvailabilityAndCalculate();
    updatePayButtonState();
});

// ===== LEGACY FUNCTION (for backward compatibility) =====
function calculateDelivery() {
    // This function is kept for backward compatibility
    // The new system automatically calculates delivery when location is set
    calculateDeliveryCharge();
}