let map;
let markers = [];
let customers = [];
let selectedCustomerId = null;
let currentLocationMarker = null;
let watchId = null;
let placeSearchMarkers = [];
let directionsRenderer = null;
let selectedLocationMarker = null;
let selectedLocation = null;
let autocomplete;
let directionsService;

// Get base URL for API calls
const BASE_URL = window.location.origin;

// Initialize the map
function initMap() {
    console.log("Initializing map...");
    
    // Default center
    const defaultCenter = { lat: 40.6702796, lng: -73.9579799 };
    
    // Initialize map
    map = new google.maps.Map(document.getElementById('map'), {
        center: defaultCenter,
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: true
    });
    
    // Initialize services
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: null,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#4285F4',
            strokeOpacity: 0.8,
            strokeWeight: 5
        }
    });
    
    // Initialize Autocomplete
    initAutocomplete();
    
    // Try to get current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                map.setCenter(userLocation);
                addCurrentLocationMarker(userLocation);
            },
            (error) => {
                console.error('Geolocation error:', error);
            }
        );
        
        startLocationTracking();
    }
    
    // Load customers
    loadCustomers();
    
    // Add map click listener for location selection
    map.addListener('click', (event) => {
        handleMapClick(event);
    });
}

// Initialize Autocomplete for search
function initAutocomplete() {
    const input = document.getElementById('places-search-input');
    autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['establishment', 'geocode'],
        fields: ['name', 'formatted_address', 'geometry', 'place_id']
    });
    
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
            alert("No details available for this place");
            return;
        }
        
        // Clear previous search markers
        clearPlaceSearchMarkers();
        
        // Add marker for selected place
        const marker = new google.maps.Marker({
            position: place.geometry.location,
            map: map,
            title: place.name,
            icon: {
                url: "data:image/svg+xml;base64," + btoa(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                        <path fill="#FF9800" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                        <circle cx="12" cy="9" r="2.5" fill="white"/>
                    </svg>
                `),
                scaledSize: new google.maps.Size(30, 30),
                anchor: new google.maps.Point(15, 30)
            }
        });
        
        placeSearchMarkers.push(marker);
        
        // Show info window with directions button
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div>
                    <h3>${place.name}</h3>
                    <p>${place.formatted_address || 'Address not available'}</p>
                    <button onclick="getDirectionsToPlace(${place.geometry.location.lat()}, ${place.geometry.location.lng()})" 
                            style="margin-top: 10px; padding: 8px 12px; background: #4285F4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        Get Directions from My Location
                    </button>
                </div>
            `
        });
        
        marker.addListener('click', () => {
            infoWindow.open(map, marker);
        });
        
        infoWindow.open(map, marker);
        
        // Center map on the place
        map.setCenter(place.geometry.location);
        map.setZoom(15);
        
        // Show clear button
        document.getElementById('clear-places-search').style.display = 'inline-block';
    });
}

// Handle map click for location selection
function handleMapClick(event) {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    // Check if clicked on existing customer marker
    const isCustomerLocation = customers.some(customer => 
        Math.abs(customer.lat - lat) < 0.0001 && Math.abs(customer.lng - lng) < 0.0001
    );
    
    if (isCustomerLocation) {
        alert('This location already has a customer. Please select a different location.');
        return;
    }
    
    // Set selected location
    selectedLocation = { lat, lng };
    
    // Update selected location marker
    updateSelectedLocationMarker(event.latLng);
    
    // Update the location selection info (NO GEOCODING HERE)
    document.getElementById('location-selection-text').innerHTML = 
        `📍 Location selected: <strong>${lat.toFixed(6)}, ${lng.toFixed(6)}</strong> (Click elsewhere to change)`;
    
    // Enable Add Customer button
    document.getElementById('add-btn').disabled = false;
    document.getElementById('add-btn').textContent = 'Add Customer';
    document.getElementById('add-btn').style.backgroundColor = '#4CAF50';
}

// Update selected location marker
function updateSelectedLocationMarker(position) {
    // Remove existing selected location marker
    if (selectedLocationMarker) {
        selectedLocationMarker.setMap(null);
    }
    
    // Create green marker for selected location
    selectedLocationMarker = new google.maps.Marker({
        position: position,
        map: map,
        title: 'Selected Location',
        icon: {
            url: "data:image/svg+xml;base64," + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <path fill="#4CAF50" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    <circle cx="12" cy="9" r="2.5" fill="white"/>
                </svg>
            `),
            scaledSize: new google.maps.Size(30, 30),
            anchor: new google.maps.Point(15, 30)
        },
        animation: google.maps.Animation.DROP
    });
}

// Get directions to a place (global function for button click)
function getDirectionsToPlace(lat, lng) {
    if (!currentLocationMarker) {
        alert('Please wait for your current location to be detected');
        return;
    }
    
    const destination = new google.maps.LatLng(lat, lng);
    const origin = currentLocationMarker.getPosition();
    
    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING
    };
    
    directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setMap(map);
            directionsRenderer.setDirections(result);
            document.getElementById('clear-directions').style.display = 'inline-block';
            
            // Show route info
            const route = result.routes[0].legs[0];
            alert(`Directions found!\nDistance: ${route.distance.text}\nDuration: ${route.duration.text}`);
        } else {
            alert('Could not get directions: ' + status);
        }
    });
}

// Add current location marker
function addCurrentLocationMarker(location) {
    if (currentLocationMarker) {
        currentLocationMarker.setMap(null);
    }
    
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
        zIndex: 1000
    });
}

// Start location tracking
function startLocationTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                addCurrentLocationMarker(userLocation);
            },
            (error) => {
                console.error('Geolocation tracking error:', error);
            }
        );
    }
}

// Recenter to current location
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
            },
            (error) => {
                alert('Could not get current location. Please ensure location services are enabled.');
            }
        );
    } else {
        alert('Geolocation is not supported by your browser.');
    }
}

// Load customers from server
async function loadCustomers() {
    try {
        const response = await fetch(`${BASE_URL}/api/customers`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        customers = await response.json();
        displayCustomers(customers);
        placeMarkers(customers);
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

// Display customers in list
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

// Create marker icons
function createRedMarkerIcon() {
    return {
        url: "data:image/svg+xml;base64," + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
            </svg>
        `),
        scaledSize: new google.maps.Size(30, 30),
        anchor: new google.maps.Point(15, 30)
    };
}

function createBlackMarkerIcon() {
    return {
        url: "data:image/svg+xml;base64," + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="#000000" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
            </svg>
        `),
        scaledSize: new google.maps.Size(30, 30),
        anchor: new google.maps.Point(15, 30)
    };
}

// Place markers on map
function placeMarkers(customers) {
    markers.forEach(marker => {
        if (marker !== currentLocationMarker && marker !== selectedLocationMarker) {
            marker.setMap(null);
        }
    });
    
    markers = markers.filter(marker => 
        marker === currentLocationMarker || marker === selectedLocationMarker
    );
    
    customers.forEach(customer => {
        const marker = new google.maps.Marker({
            position: { lat: parseFloat(customer.lat), lng: parseFloat(customer.lng) },
            map: map,
            title: customer.name,
            icon: createRedMarkerIcon()
        });
        
        marker.addListener('click', () => {
            selectCustomer(customer._id);
        });
        
        markers.push(marker);
    });
}

// Select customer
function selectCustomer(customerId) {
    markers.forEach(marker => {
        if (marker !== currentLocationMarker && marker !== selectedLocationMarker) {
            marker.setIcon(createRedMarkerIcon());
        }
    });
    
    selectedCustomerId = customerId;
    
    document.querySelectorAll('.customer-item').forEach(item => {
        if (item.dataset.id === customerId) {
            item.classList.add('selected-customer');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('selected-customer');
        }
    });
    
    const customer = customers.find(c => c._id === customerId);
    if (customer) {
        map.setCenter({ lat: parseFloat(customer.lat), lng: parseFloat(customer.lng) });
        map.setZoom(15);
        
        const marker = markers.find(m => 
            m !== currentLocationMarker && 
            m !== selectedLocationMarker &&
            m.getPosition().lat() === parseFloat(customer.lat) && 
            m.getPosition().lng() === parseFloat(customer.lng)
        );
        
        if (marker) {
            marker.setIcon(createBlackMarkerIcon());
        }
    }
}

// Clear place search markers
function clearPlaceSearchMarkers() {
    placeSearchMarkers.forEach(marker => marker.setMap(null));
    placeSearchMarkers = [];
    document.getElementById('clear-places-search').style.display = 'none';
    document.getElementById('places-search-input').value = '';
}

// Clear directions
function clearDirections() {
    directionsRenderer.setMap(null);
    document.getElementById('clear-directions').style.display = 'none';
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Google Maps
    function checkGoogleMapsLoaded() {
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            initMap();
        } else {
            setTimeout(checkGoogleMapsLoaded, 100);
        }
    }
    checkGoogleMapsLoaded();
    
    // Modal elements
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close');
    const customerForm = document.getElementById('customer-form');
    
    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Add customer button
    document.getElementById('add-btn').addEventListener('click', () => {
        if (!selectedLocation) {
            alert('Please select a location on the map first');
            return;
        }
        
        // Fill the modal with selected location info (coordinates only)
        document.getElementById('selected-coordinates').textContent = 
            `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;
        
        // Set hidden fields (coordinates only - address will be filled by backend)
        document.getElementById('lat').value = selectedLocation.lat;
        document.getElementById('lng').value = selectedLocation.lng;
        
        // Reset form
        document.getElementById('name').value = '';
        document.getElementById('description').value = '';
        document.getElementById('comment').value = '';
        
        modal.style.display = 'block';
    });
    
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
    
    // Search places button
    document.getElementById('places-search-btn').addEventListener('click', () => {
        const input = document.getElementById('places-search-input');
        if (input.value.trim()) {
            // Trigger the autocomplete
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
        }
    });
    
    // Clear places search
    document.getElementById('clear-places-search').addEventListener('click', clearPlaceSearchMarkers);
    
    // Clear directions
    document.getElementById('clear-directions').addEventListener('click', clearDirections);
    
    // Recenter button
    document.getElementById('recenter-btn').addEventListener('click', recenterToMyLocation);
    
    // Form submission
    customerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const description = document.getElementById('description').value;
        const comment = document.getElementById('comment').value;
        const lat = document.getElementById('lat').value;
        const lng = document.getElementById('lng').value;
        
        if (!name) {
            alert('Please enter a customer name');
            return;
        }
        
        const customerData = {
            name,
            Description: description,
            Comment: comment,
            lat: parseFloat(lat),
            lng: parseFloat(lng)
            // Address will be filled by the backend through geocoding
        };
        
        try {
            const response = await fetch(`${BASE_URL}/api/customers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(customerData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert(`Customer added successfully!\nAddress: ${result.address}`);
                modal.style.display = 'none';
                
                // Reset selection
                if (selectedLocationMarker) {
                    selectedLocationMarker.setMap(null);
                    selectedLocationMarker = null;
                }
                selectedLocation = null;
                document.getElementById('add-btn').disabled = true;
                document.getElementById('add-btn').textContent = 'Add Customer (Select location first)';
                document.getElementById('add-btn').style.backgroundColor = '#ccc';
                document.getElementById('location-selection-text').innerHTML = 
                    '📍 Click anywhere on the map to select a location (green marker will appear)';
                
                // Reload customers
                loadCustomers();
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert('Error adding customer');
        }
    });
    
    // Update customer button
    document.getElementById('update-btn').addEventListener('click', () => {
        if (!selectedCustomerId) {
            alert('Please select a customer to update');
            return;
        }
        
        const customer = customers.find(c => c._id === selectedCustomerId);
        if (customer) {
            document.getElementById('modal-title').textContent = 'Update Customer';
            document.getElementById('customer-id').value = customer._id;
            document.getElementById('name').value = customer.name;
            document.getElementById('description').value = customer.Description || '';
            document.getElementById('comment').value = customer.Comment || '';
            document.getElementById('selected-address').textContent = customer.Address || 'No address';
            document.getElementById('selected-coordinates').textContent = 
                `${customer.lat}, ${customer.lng}`;
            document.getElementById('lat').value = customer.lat;
            document.getElementById('lng').value = customer.lng;
            document.getElementById('form-submit').textContent = 'Update Customer';
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
                
                if (response.ok) {
                    alert('Customer deleted successfully');
                    loadCustomers();
                    selectedCustomerId = null;
                } else {
                    const result = await response.json();
                    alert(`Error: ${result.error}`);
                }
            } catch (error) {
                alert('Error deleting customer');
            }
        }
    });
    
    // Export CSV button
    document.getElementById('export-btn').addEventListener('click', async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/customers/export`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'customers_export.csv';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                alert('CSV export completed successfully!');
            }
        } catch (error) {
            alert('Error exporting CSV');
        }
    });
    
    // Import CSV button
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('csv-file-input').click();
    });
    
    document.getElementById('csv-file-input').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!confirm('WARNING: This will delete all existing customers. Continue?')) {
            event.target.value = '';
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`${BASE_URL}/api/customers/import`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (response.ok) {
                alert(result.message);
                loadCustomers();
            } else {
                alert(`Import failed: ${result.error}`);
            }
        } catch (error) {
            alert('Error importing CSV');
        } finally {
            event.target.value = '';
        }
    });
    
    // Enter key for search
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('search-btn').click();
        }
    });
    
    document.getElementById('places-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('places-search-btn').click();
        }
    });
});
