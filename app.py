from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
import os
import math
import csv
import io
from flask import send_file
import requests
from math import radians, sin, cos, sqrt, atan2

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# MongoDB connection using environment variable
connection_string = os.environ.get('MONGODB_URI', 'mongodb+srv://alielnashar24:a91423097@cluster0.ly8gqfr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
client = MongoClient(connection_string)
db = client['location_database']
collection = db['locations']

# Your Google Maps API key
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', 'AIzaSyDF69V8fQBt8A1DE0JttNPQUAzzSTrQA8M')

@app.route('/')
def index():
    return render_template('index.html', google_maps_api_key=GOOGLE_MAPS_API_KEY)

# Get all customers
@app.route('/api/customers', methods=['GET'])
def get_customers():
    customers = list(collection.find({}))
    
    # Convert ObjectId to string and handle NaN values for JSON serialization
    for customer in customers:
        customer['_id'] = str(customer['_id'])
        
        # Convert NaN values to None for JSON serialization
        for field in ['Description', 'Comment', 'Address']:
            if field in customer and isinstance(customer[field], float) and math.isnan(customer[field]):
                customer[field] = None
    
    return jsonify(customers)

# Search customers by name
@app.route('/api/customers/search/<name>', methods=['GET'])
def search_customers(name):
    query = {"name": {"$regex": name, "$options": "i"}}  # Case-insensitive search
    customers = list(collection.find(query))
    
    # Convert ObjectId to string and handle NaN values for JSON serialization
    for customer in customers:
        customer['_id'] = str(customer['_id'])
        
        # Convert NaN values to None for JSON serialization
        for field in ['Description', 'Comment', 'Address']:
            if field in customer and isinstance(customer[field], float) and math.isnan(customer[field]):
                customer[field] = None
    
    return jsonify(customers)

# Get a single customer
@app.route('/api/customers/<customer_id>', methods=['GET'])
def get_customer(customer_id):
    try:
        customer = collection.find_one({'_id': ObjectId(customer_id)})
        if customer:
            customer['_id'] = str(customer['_id'])
            
            # Convert NaN values to None for JSON serialization
            for field in ['Description', 'Comment', 'Address']:
                if field in customer and isinstance(customer[field], float) and math.isnan(customer[field]):
                    customer[field] = None
            
            return jsonify(customer)
        return jsonify({'error': 'Customer not found'}), 404
    except:
        return jsonify({'error': 'Invalid customer ID'}), 400

# Geocode coordinates to address
def geocode_coordinates(lat, lng):
    try:
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={GOOGLE_MAPS_API_KEY}"
        response = requests.get(url)
        data = response.json()
        
        if data['status'] == 'OK' and data['results']:
            return data['results'][0]['formatted_address']
        else:
            return "Address not found"
    except Exception as e:
        print(f"Geocoding error: {e}")
        return "Address lookup failed"

# Add a new customer
@app.route('/api/customers', methods=['POST'])
def add_customer():
    data = request.get_json()
    # Validate required fields
    if not data.get('name') or not data.get('lat') or not data.get('lng'):
        return jsonify({'error': 'Name, lat, and lng are required'}), 400
    
    # Get address from coordinates using geocoding (AFTER form submission)
    address = geocode_coordinates(data['lat'], data['lng'])
    data['Address'] = address
    
    # Set default values for optional fields
    for field in ['Description', 'Comment']:
        if field not in data or not data[field]:
            data[field] = ""
    
    # Insert the new customer
    result = collection.insert_one(data)
    new_customer_id = str(result.inserted_id)
    
    return jsonify({
        '_id': new_customer_id, 
        'message': 'Customer added successfully',
        'address': address
    }), 201

# Update a customer - FIXED VERSION
@app.route('/api/customers/<customer_id>', methods=['PUT'])
def update_customer(customer_id):
    data = request.get_json()
    try:
        # If lat/lng changed, update address using geocoding
        if 'lat' in data and 'lng' in data:
            address = geocode_coordinates(data['lat'], data['lng'])
            data['Address'] = address
        
        result = collection.update_one({'_id': ObjectId(customer_id)}, {'$set': data})
        if result.modified_count:
            return jsonify({'message': 'Customer updated successfully'})
        return jsonify({'error': 'Customer not found'}), 404
    except Exception as e:
        print(f"Update error: {e}")
        return jsonify({'error': 'Invalid customer ID'}), 400

# Delete a customer by ID
@app.route('/api/customers/<customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    try:
        result = collection.delete_one({'_id': ObjectId(customer_id)})
        if result.deleted_count:
            return jsonify({'message': 'Customer deleted successfully'})
        return jsonify({'error': 'Customer not found'}), 404
    except:
        return jsonify({'error': 'Invalid customer ID'}), 400

# Delete a customer by name
@app.route('/api/customers/name/<name>', methods=['DELETE'])
def delete_customer_by_name(name):
    result = collection.delete_one({'name': name})
    if result.deleted_count:
        return jsonify({'message': 'Customer deleted successfully'})
    return jsonify({'error': 'Customer not found'}), 404

# Search for places using Google Places API
@app.route('/api/places/search', methods=['GET'])
def search_places():
    query = request.args.get('query', '')
    
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
    
    try:
        url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={query}&key={GOOGLE_MAPS_API_KEY}"
        response = requests.get(url)
        data = response.json()
        
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'Place search failed: {str(e)}'}), 500

# Get directions between two points
@app.route('/api/directions', methods=['GET'])
def get_directions():
    origin = request.args.get('origin', '')
    destination = request.args.get('destination', '')
    
    if not origin or not destination:
        return jsonify({'error': 'Origin and destination parameters are required'}), 400
    
    try:
        url = f"https://maps.googleapis.com/maps/api/directions/json?origin={origin}&destination={destination}&key={GOOGLE_MAPS_API_KEY}"
        response = requests.get(url)
        data = response.json()
        
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'Directions request failed: {str(e)}'}), 500

# Export customers as CSV
@app.route('/api/customers/export', methods=['GET'])
def export_customers():
    try:
        customers = list(collection.find({}))
        
        # Create a CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(['name', 'Description', 'Comment', 'Address', 'lat', 'lng'])
        
        # Write data
        for customer in customers:
            # Handle NaN values
            description = customer.get('Description', '')
            comment = customer.get('Comment', '')
            address = customer.get('Address', '')
            
            if isinstance(description, float) and math.isnan(description):
                description = ''
            if isinstance(comment, float) and math.isnan(comment):
                comment = ''
            if isinstance(address, float) and math.isnan(address):
                address = ''
                
            writer.writerow([
                customer.get('name', ''),
                description,
                comment,
                address,
                customer.get('lat', ''),
                customer.get('lng', '')
            ])
        
        # Prepare response
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name='customers_export.csv'
        )
        
    except Exception as e:
        return jsonify({'error': f'Export failed: {str(e)}'}), 500

# Import customers from CSV
@app.route('/api/customers/import', methods=['POST'])
def import_customers():
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        
        # Check if file is CSV
        if not file.filename.lower().endswith('.csv'):
            return jsonify({'error': 'File must be a CSV'}), 400
        
        # Read and parse CSV
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        
        # Validate CSV structure
        required_fields = ['name', 'lat', 'lng']
        if not all(field in csv_reader.fieldnames for field in required_fields):
            return jsonify({'error': 'CSV must contain name, lat, and lng columns'}), 400
        
        # Clear existing data
        collection.delete_many({})
        
        # Prepare data for bulk insertion
        customers_to_insert = []
        imported_count = 0
        
        for row in csv_reader:
            # Prepare customer data
            customer_data = {
                'name': row['name'],
                'Description': row.get('Description', ''),
                'Comment': row.get('Comment', ''),
                'Address': row.get('Address', ''),
                'lat': float(row['lat']),
                'lng': float(row['lng'])
            }
            
            customers_to_insert.append(customer_data)
            imported_count += 1
        
        # Insert all data in bulk if there are any records
        if customers_to_insert:
            collection.insert_many(customers_to_insert)
        
        return jsonify({'message': f'Successfully imported {imported_count} customers'})
        
    except ValueError as e:
        return jsonify({'error': f'Invalid data format: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Import failed: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)