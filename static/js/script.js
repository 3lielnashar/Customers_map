let map;
let markers = [];
let customers = [];
let selectedCustomerId = null;
let currentLocationMarker = null;
let watchId = null;

// Get base URL for API calls
const BASE_URL = window.location.origin;

// Initialize the map
function initMap() {
    console.log("Initializing map...");
    
    // Default center (will be overridden if geolocation works)
    const defaultCenter = { lat: 40.6702796, lng: -73.9579799 };
    
    // Try to get current location
    if (navigator.geolocation) {
        // Start continuous location tracking
        startLocationTracking();
        
        // Also get initial position quickly
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Success: Use current location
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                initMapWithCenter(userLocation);
                addCurrentLocationMarker(userLocation);
            },
            (error) => {
                // Error: Use default center
                console.error('Geolocation error:', error);
                initMapWithCenter(defaultCenter);
            }
        );
    } else {
        // Geolocation not supported
        console.error('Geolocation is not supported by this browser.');
        initMapWithCenter(defaultCenter);
    }
}

// Start continuous location tracking
function startLocationTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Update current location marker
                addCurrentLocationMarker(userLocation);
                
                console.log('Location updated:', userLocation);
            },
            (error) => {
                console.error('Geolocation tracking error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000 // Update every 30 seconds max
            }
        );
    }
}

// Stop location tracking
function stopLocationTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        console.log('Location tracking stopped');
    }
}

// Initialize map with a specific center
function initMapWithCenter(center) {
    map = new google.maps.Map(document.getElementById('map'), {
        center: center,
        zoom: 15
    });
    
    // Load customers from the server
    loadCustomers();
    
    // Add click event to the map to get coordinates
    map.addListener('click', (event) => {
        if (document.getElementById('modal').style.display === 'block') {
            document.getElementById('lat').value = event.latLng.lat();
            document.getElementById('lng').value = event.latLng.lng();
        }
    });
    
    console.log("Map initialized successfully with center:", center);
}

// Add current location marker
function addCurrentLocationMarker(location) {
    // Remove existing current location marker if any
    if (currentLocationMarker) {
        currentLocationMarker.setMap(null);
    }
    
    // Create a special marker for current location
    currentLocationMarker = new google.maps.Marker({
        position: location,
        map: map,
        title: 'My Current Location',
        icon: {
            url: "data:image/svg+xml;base64," + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="#4285F4" opacity="0.7"/>
                    <circle cx="12" cy="12" r="5" fill="#4285F4"/>
                    <circle cx="12" cy="12" r="2" fill="white"/>
                </svg>
            `),
            scaledSize: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12)
        },
        zIndex: 1000 // Ensure it appears above other markers
    });
    
    // Add info window for current location
    const infoWindow = new google.maps.InfoWindow({
        content: '<strong>My Current Location</strong>'
    });
    
    currentLocationMarker.addListener('click', () => {
        infoWindow.open(map, currentLocationMarker);
    });
}

// Recenter map to current location
function recenterToMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                map.setCenter(userLocation);
                map.setZoom(15);
                addCurrentLocationMarker(userLocation);
                
                console.log('Recenter to:', userLocation);
            },
            (error) => {
                console.error('Geolocation error during recenter:', error);
                
                // Provide specific error messages based on the error code
                let errorMessage = 'Could not get current location. ';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Location permission was denied. Please allow location access in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information is unavailable. Please check your device location services.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Location request timed out. Please try again.';
                        break;
                    default:
                        errorMessage += 'Please ensure location services are enabled.';
                        break;
                }
                
                alert(errorMessage);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000, // Increase timeout to 10 seconds
                maximumAge: 0 // Don't use cached position
            }
        );
    } else {
        alert('Geolocation is not supported by your browser. Please use a modern browser like Chrome, Firefox, or Safari.');
    }
}

// Load customers from the server
async function loadCustomers() {
    try {
        console.log("Loading customers...");
        const response = await fetch(`${BASE_URL}/api/customers`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        customers = await response.json();
        console.log(`Loaded ${customers.length} customers`);
        
        displayCustomers(customers);
        placeMarkers(customers);
    } catch (error) {
        console.error('Error loading customers:', error);
        // Show error message in the customer list area
        document.getElementById('customer-list').innerHTML = 
            '<div class="error">Error loading customers: ' + error.message + '</div>';
    }
}

// Display customers in the list
function displayCustomers(customers) {
    const customerList = document.getElementById('customer-list');
    
    if (customers.length === 0) {
        customerList.innerHTML = '<div class="loading">No customers found</div>';
        return;
    }
    
    customerList.innerHTML = '';
    
    customers.forEach(customer => {
        const customerItem = document.createElement('div');
        customerItem.className = 'customer-item';
        customerItem.dataset.id = customer._id;
        
        if (customer._id === selectedCustomerId) {
            customerItem.classList.add('selected-customer');
        }
        
        customerItem.innerHTML = `
            <h3>${customer.name}</h3>
            <p><strong>Address:</strong> ${customer.Address || 'No address'}</p>
            <p>${customer.Description || 'No description'}</p>
        `;
        
        customerItem.addEventListener('click', () => {
            selectCustomer(customer._id);
        });
        
        customerList.appendChild(customerItem);
    });
}

// Create a black marker icon
function createBlackMarkerIcon() {
    return {
        url: "data:image/svg+xml;base64," + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="#000000" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
            </svg>
        `),
        scaledSize: new google.maps.Size(30, 30),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(15, 30)
    };
}

// Create a red marker icon
function createRedMarkerIcon() {
    return {
        url: "data:image/svg+xml;base64," + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
            </svg>
        `),
        scaledSize: new google.maps.Size(30, 30),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(15, 30)
    };
}

// Place markers on the map
function placeMarkers(customers) {
    // Clear existing markers (except current location marker)
    markers.forEach(marker => {
        if (marker !== currentLocationMarker) {
            marker.setMap(null);
        }
    });
    markers = markers.filter(marker => marker === currentLocationMarker);
    
    if (customers.length === 0) {
        return;
    }
    
    customers.forEach(customer => {
        const marker = new google.maps.Marker({
            position: { lat: parseFloat(customer.lat), lng: parseFloat(customer.lng) },
            map: map,
            title: customer.name,
            icon: createRedMarkerIcon() // Default red icon
        });
        
        marker.addListener('click', () => {
            selectCustomer(customer._id);
        });
        
        markers.push(marker);
    });
}

// Select a customer and center the map
function selectCustomer(customerId) {
    // Reset all markers to red first (except current location marker)
    markers.forEach(marker => {
        if (marker !== currentLocationMarker) {
            marker.setIcon(createRedMarkerIcon());
        }
    });
    
    selectedCustomerId = customerId;
    
    // Highlight the selected customer in the list
    document.querySelectorAll('.customer-item').forEach(item => {
        if (item.dataset.id === customerId) {
            item.classList.add('selected-customer');
            
            // Ensure the selected customer is visible in the list
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('selected-customer');
        }
    });
    
    // Find the customer and center the map
    const customer = customers.find(c => c._id === customerId);
    if (customer) {
        map.setCenter({ 
            lat: parseFloat(customer.lat), 
            lng: parseFloat(customer.lng) 
        });
        map.setZoom(15);
        
        // Change the clicked marker to black
        const markerIndex = customers.findIndex(c => c._id === customerId);
        if (markerIndex !== -1) {
            // Adjust index if currentLocationMarker exists in the markers array
            const adjustedIndex = markers.findIndex(m => 
                m !== currentLocationMarker && 
                m.getPosition().lat() === parseFloat(customer.lat) && 
                m.getPosition().lng() === parseFloat(customer.lng)
            );
            
            if (adjustedIndex !== -1 && markers[adjustedIndex]) {
                markers[adjustedIndex].setIcon(createBlackMarkerIcon());
            }
        }
    }
}

// Set up all event listeners when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded, setting up event listeners...");
    
    // Initialize Google Maps after it loads
    function checkGoogleMapsLoaded() {
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            initMap();
        } else {
            setTimeout(checkGoogleMapsLoaded, 100);
        }
    }
    
    // Start checking for Google Maps
    checkGoogleMapsLoaded();
    
    // Search customers
    document.getElementById('search-btn').addEventListener('click', async () => {
        const searchTerm = document.getElementById('search-input').value;
        
        if (searchTerm.trim() === '') {
            loadCustomers();
            return;
        }
        
        try {
            const response = await fetch(`${BASE_URL}/api/customers/search/${encodeURIComponent(searchTerm)}`);
            const filteredCustomers = await response.json();
            displayCustomers(filteredCustomers);
            placeMarkers(filteredCustomers);
        } catch (error) {
            console.error('Error searching customers:', error);
        }
    });

    // Modal functionality
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close');
    const customerForm = document.getElementById('customer-form');
    const modalTitle = document.getElementById('modal-title');
    const formSubmit = document.getElementById('form-submit');

    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Add customer button
    document.getElementById('add-btn').addEventListener('click', () => {
        modalTitle.textContent = 'Add Customer';
        customerForm.reset();
        document.getElementById('customer-id').value = '';
        document.getElementById('address').value = ''; // Clear address field
        formSubmit.textContent = 'Add Customer';
        modal.style.display = 'block';
    });

    // Update customer button
    document.getElementById('update-btn').addEventListener('click', () => {
        if (!selectedCustomerId) {
            alert('Please select a customer to update');
            return;
        }
        
        const customer = customers.find(c => c._id === selectedCustomerId);
        if (customer) {
            modalTitle.textContent = 'Update Customer';
            document.getElementById('customer-id').value = customer._id;
            document.getElementById('name').value = customer.name;
            document.getElementById('description').value = customer.Description || '';
            document.getElementById('comment').value = customer.Comment || '';
            document.getElementById('address').value = customer.Address || '';
            document.getElementById('lat').value = customer.lat;
            document.getElementById('lng').value = customer.lng;
            formSubmit.textContent = 'Update Customer';
            modal.style.display = 'block';
        }
    });

    // Delete customer button
    document.getElementById('delete-btn').addEventListener('click', async () => {
        if (!selectedCustomerId) {
            alert('Please select a customer to delete');
            return;
        }
        
        if (confirm('Are you sure you want to delete this customer?')) {
            try {
                const response = await fetch(`${BASE_URL}/api/customers/${selectedCustomerId}`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('Customer deleted successfully');
                    loadCustomers();
                    selectedCustomerId = null;
                } else {
                    alert(`Error: ${result.error}`);
                }
            } catch (error) {
                console.error('Error deleting customer:', error);
                alert('Error deleting customer');
            }
        }
    });

    // Export CSV button
    document.getElementById('export-btn').addEventListener('click', async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/customers/export`);
            
            if (response.ok) {
                // Create a blob from the response
                const blob = await response.blob();
                
                // Create a download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'customers_export.csv';
                
                // Add to document, click, and remove
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                alert('CSV export completed successfully!');
            } else {
                const error = await response.json();
                alert(`Export failed: ${error.error}`);
            }
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Error exporting CSV');
        }
    });

    // Import CSV button
    document.getElementById('import-btn').addEventListener('click', () => {
        // Trigger the hidden file input
        document.getElementById('csv-file-input').click();
    });

    // Handle file selection for import
    document.getElementById('csv-file-input').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        
        if (!file) {
            return;
        }
        
        // Confirm before proceeding (this will delete all existing data)
        if (!confirm('WARNING: This will delete all existing customers and replace them with the imported data. Continue?')) {
            // Reset the file input
            event.target.value = '';
            return;
        }
        
        try {
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            
            // Send to server
            const response = await fetch(`${BASE_URL}/api/customers/import`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert(result.message);
                // Reload the customers
                loadCustomers();
            } else {
                alert(`Import failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Error importing CSV:', error);
            alert('Error importing CSV');
        } finally {
            // Reset the file input
            event.target.value = '';
        }
    });

    // Recenter button
    document.getElementById('recenter-btn').addEventListener('click', () => {
        recenterToMyLocation();
    });

    // Form submission
    customerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const customerId = document.getElementById('customer-id').value;
        const name = document.getElementById('name').value;
        const description = document.getElementById('description').value;
        const comment = document.getElementById('comment').value;
        const address = document.getElementById('address').value;
        const lat = document.getElementById('lat').value;
        const lng = document.getElementById('lng').value;
        
        const customerData = {
            name,
            Description: description,
            Comment: comment,
            Address: address,
            lat: parseFloat(lat),
            lng: parseFloat(lng)
        };
        
        try {
            let response;
            
            if (customerId) {
                // Update existing customer
                response = await fetch(`${BASE_URL}/api/customers/${customerId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(customerData)
                });
            } else {
                // Add new customer
                response = await fetch(`${BASE_URL}/api/customers`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(customerData)
                });
            }
            
            const result = await response.json();
            
            if (response.ok) {
                alert(customerId ? 'Customer updated successfully' : 'Customer added successfully');
                modal.style.display = 'none';
                loadCustomers();
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            console.error('Error saving customer:', error);
            alert('Error saving customer');
        }
    });
    
    // Stop tracking when page is unloaded
    window.addEventListener('beforeunload', () => {
        stopLocationTracking();
    });
    
    console.log("Event listeners set up successfully");
});