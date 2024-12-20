const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer'); // Import multer
const XLSX = require('xlsx'); // For reading Excel files
const fetch = require('node-fetch');
const { google } = require('googleapis');
const sheets = google.sheets('v4');
const WebSocket = require('ws'); // Added WebSocket

const app = express();
const PORT = 3000;

// Initialize Google Sheets API authentication
const auth = new google.auth.GoogleAuth({
    keyFile: './json key/monitoring-pats-afcab2128b03.json', // Replace with the path to your JSON key file
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

// Initialize WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8080 });
let lastFetchedData = null; // Cache to store last fetched data

// Helper function to notify all clients of data update
function notifyClients() {
    console.log("Notifying clients of data update...");
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ message: 'Data updated' }));
            console.log("Data update message sent to client.");
        } else {
            console.log("WebSocket client not open, unable to send message.");
        }
    });
}

// Google Sheets data fetch function
async function fetchGoogleSheetData() {
    try {
        const authClient = await auth.getClient();
        const spreadsheetId = '1QGCYIOxBKEe9G0FduPmmL4PvqiiAXOGHWfW2PYz74M0';
        const response = await sheets.spreadsheets.values.batchGet({
            auth: authClient,
            spreadsheetId: spreadsheetId,
            ranges: [
                'BnR!B4:C', 'SAYURAN!B4:C', 'RIMPANGAN!B4:C', 'REMPAH&BEAN!B4:C',
                'DRY&POWDER!B4:C', 'TTnJ!B4:C', 'BUAH!B4:C', 'PRODUK!B4:C', 'UKM!B4:D'
            ],
        });
        console.log("Fetched data from Google Sheets:", response.data.valueRanges);
        return response.data.valueRanges;
    } catch (error) {
        console.error("Error fetching Google Sheets data:", error);
        return null;
    }
}

// Polling function to check for updates in Google Sheets
async function checkForUpdates() {
    const data = await fetchGoogleSheetData();
    if (data && JSON.stringify(data) !== JSON.stringify(lastFetchedData)) {
        console.log("Change detected in Google Sheets data.");
        lastFetchedData = data;
        notifyClients(); // Notify all clients of update
    } else {
        console.log("No change detected in Google Sheets data.");
    }
}

// Set interval to poll Google Sheets every 60 seconds
setInterval(checkForUpdates, 60000); // Poll every 60 seconds

// WebSocket connection handler
wss.on('connection', ws => {
    console.log('Client connected to WebSocket');
    ws.send(JSON.stringify({ message: 'Connected to WebSocket server' }));
});

// =============================
// Multer Configuration for File Uploads
// =============================

// Ensure 'uploads/' directory exists
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Ensure 'uploads/' exists and is writable
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });


// Initialize SQLite database connection with logging
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');

                // Enable WAL mode for improved concurrency
                db.exec('PRAGMA journal_mode = WAL;', (err) => {
                    if (err) {
                        console.error('Failed to set WAL mode:', err.message);
                    } else {
                        console.log('WAL mode enabled.');
                    }
                });

        // Check if table creation runs properly
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            number TEXT NOT NULL,
            variable TEXT
        )`, (err) => {
            if (err) {
                console.error('Failed to create table:', err.message);
            } else {
                console.log('Contacts table is ready.');
            }
        });
        // Create Broadcast Templates table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS broadcast_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_name TEXT NOT NULL,
            message TEXT NOT NULL,
            schedule TEXT NOT NULL,
            send_to TEXT,
            file_path TEXT
        )`, (err) => {
            if (err) {
                console.error('Failed to create Broadcast Templates table:', err.message);
            } else {
                console.log('Broadcast Templates table is ready.');
            }
        });
        // Create Message Logs table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    file_path TEXT,
    sent_to TEXT NOT NULL,
    time_sent TEXT NOT NULL
)`, (err) => {
    if (err) {
        console.error('Failed to create Message Logs table:', err.message);
    } else {
        console.log('Message Logs table is ready.');
    }
});

// Create the inventory table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_produk TEXT NOT NULL,
    modal REAL NOT NULL
)`, (err) => {
    if (err) {
        console.error('Failed to create inventory table:', err.message);
    } else {
        console.log('Inventory table is ready.');
    }
});

}
});

app.use(cors());
app.use(express.json()); // Parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files


// Route to handle Excel file upload and import contacts
app.post('/api/import-contacts', upload.single('file'), (req, res) => {
    const filePath = req.file.path;

    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use the first sheet
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Insert each contact into the database
    const query = 'INSERT INTO contacts (name, number, variable) VALUES (?, ?, ?)';
    data.forEach((row) => {
        const { Name, Number, Variable } = row;
        db.run(query, [Name, Number, Variable], (err) => {
            if (err) console.error('Error inserting contact:', err.message);
        });
    });

    res.status(200).json({ message: 'Contacts imported successfully!' });
});

// API route to add a new contact
app.post('/api/contacts', (req, res) => {
    const { name, number, variable } = req.body;

    // Log request body to ensure the frontend sends the correct data
    console.log('Received data:', req.body);

    const query = 'INSERT INTO contacts (name, number, variable) VALUES (?, ?, ?)';

    db.run(query, [name, number, variable], function (err) {
        if (err) {
            console.error('SQL Error:', err.message); // Log any SQL errors
            res.status(500).json({ error: 'Failed to add contact.' });
        } else {
            console.log(`Contact added with ID: ${this.lastID}`); // Log success
            res.status(201).json({ id: this.lastID }); // Send back new contact's ID
        }
    });
});

// GET route to fetch all contacts
app.get('/api/contacts', (req, res) => {
    const query = 'SELECT * FROM contacts';

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching contacts:', err.message);
            res.status(500).json({ error: 'Failed to load contacts.' });
        } else {
            console.log('Contacts fetched successfully:', rows); // Log the data to confirm
            res.json(rows); // Send the contacts as JSON
        }
    });
});

// Route to fetch contacts by variable
app.get('/api/contacts/by-variable', (req, res) => {
    const { variable } = req.query;
    if (!variable) {
        return res.status(400).json({ error: 'Variable parameter is required.' });
    }

    const query = 'SELECT * FROM contacts WHERE variable = ?';
    db.all(query, [variable], (err, rows) => {
        if (err) {
            console.error('Error fetching contacts by variable:', err.message);
            res.status(500).json({ error: 'Failed to load contacts by variable.' });
        } else {
            res.json(rows); // Send contacts with the specified variable as JSON
        }
    });
});

// DELETE route to remove a contact by ID
app.delete('/api/contacts/:id', (req, res) => {
    const { id } = req.params;

    const query = 'DELETE FROM contacts WHERE id = ?';
    db.run(query, [id], function (err) {
        if (err) {
            console.error('Error deleting contact:', err.message);
            res.status(500).json({ error: 'Failed to delete contact.' });
        } else {
            console.log(`Contact with ID ${id} deleted.`);
            res.status(200).json({ message: 'Contact deleted successfully.' });
        }
    });
});

// PUT route to update a contact by ID
app.put('/api/contacts/:id', (req, res) => {
    const { id } = req.params;
    const { name, number, variable } = req.body;

    const query = 'UPDATE contacts SET name = ?, number = ?, variable = ? WHERE id = ?';
    db.run(query, [name, number, variable, id], function (err) {
        if (err) {
            console.error('Error updating contact:', err.message);
            res.status(500).json({ error: 'Failed to update contact.' });
        } else {
            console.log(`Contact with ID ${id} updated.`);
            res.status(200).json({ message: 'Contact updated successfully.' });
        }
    });
});


// ========== Variable Groups Route ==========
// Route to fetch unique variable groups
app.get('/api/variable-groups', (req, res) => {
    const query = 'SELECT DISTINCT variable FROM contacts WHERE variable IS NOT NULL';

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching variable groups:', err.message);
            res.status(500).json({ error: 'Failed to load variable groups.' });
        } else {
            const groups = rows.map(row => row.variable);
            res.json(groups);
        }
    });
});

function runQueryWithRetry(query, params, callback) {
    const maxRetries = 5; // Number of times to retry
    let attempts = 0;

    function executeQuery() {
        db.run(query, params, function (err) {
            if (err && err.message.includes('SQLITE_BUSY')) {
                if (attempts < maxRetries) {
                    attempts++;
                    console.log(`Retrying query (attempt ${attempts})...`);
                    setTimeout(executeQuery, 100); // Wait 100 ms before retrying
                } else {
                    console.error('Failed to add broadcast after multiple attempts:', err.message);
                    callback(err);
                }
            } else {
                callback(null, this);
            }
        });
    }

    executeQuery();
}

// ========== Broadcast-related Routes ==========
// Helper function to validate datetime format (YYYY-MM-DD HH:mm:ss)
function isValidDateTime(datetime) {
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(datetime);
}

// Modify the add broadcast route
app.post('/api/broadcasts', upload.single('file'), (req, res) => {
    const { template_name, message, schedule, send_to } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate schedule format
    if (!isValidDateTime(schedule)) {
        return res.status(400).json({ error: 'Invalid schedule format. Use "YYYY-MM-DD HH:mm:ss"' });
    }

    const query = `
        INSERT INTO broadcast_templates (template_name, message, schedule, send_to, file_path)
        VALUES (?, ?, ?, ?, ?)
    `;

    runQueryWithRetry(query, [template_name, message, schedule, send_to, file_path], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Failed to add broadcast due to database lock.' });
        } else {
            res.status(201).json({ id: result.lastID });
        }
    });
});

// API route to fetch all broadcasts
app.get('/api/broadcasts', (req, res) => {
    const query = 'SELECT * FROM broadcast_templates';

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching broadcasts:', err.message);
            res.status(500).json({ error: 'Failed to load broadcasts.' });
        } else {
            console.log('Broadcasts fetched successfully:', rows); // Log the data to confirm
            res.json(rows); // Send the broadcasts as JSON
        }
    });
});


// Route to update a broadcast
// Modify the update broadcast route
app.put('/api/broadcasts/:id', upload.single('file'), (req, res) => {
    const { id } = req.params;
    const template_name = req.body.template_name;
    const message = req.body.message;
    const schedule = req.body.schedule;
    const send_to = req.body.send_to;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate schedule format
    if (!isValidDateTime(schedule)) {
        return res.status(400).json({ error: 'Invalid schedule format. Use "YYYY-MM-DD HH:mm:ss"' });
    }

    let query;
    let params;

    // If a file was uploaded, include file_path in the update query
    if (file_path) {
        query = `
            UPDATE broadcast_templates 
            SET template_name = ?, message = ?, schedule = ?, send_to = ?, file_path = ?
            WHERE id = ?
        `;
        params = [template_name, message, schedule, send_to, file_path, id];
    } else {
        query = `
            UPDATE broadcast_templates 
            SET template_name = ?, message = ?, schedule = ?, send_to = ?
            WHERE id = ?
        `;
        params = [template_name, message, schedule, send_to, id];
    }

    db.run(query, params, function (err) {
        if (err) {
            res.status(500).json({ error: 'Failed to update broadcast.' });
        } else {
            res.status(200).json({ message: 'Broadcast updated successfully.' });
        }
    });
});

// Route to delete a broadcast
app.delete('/api/broadcasts/:id', (req, res) => {
    const { id } = req.params;

    const query = 'DELETE FROM broadcast_templates WHERE id = ?';
    db.run(query, [id], function (err) {
        if (err) {
            console.error('Failed to delete broadcast:', err.message);
            res.status(500).json({ error: 'Failed to delete broadcast.' });
        } else {
            res.status(200).json({ message: 'Broadcast deleted successfully.' });
        }
    });
});

app.post('/api/whacenter-send', async (req, res) => {
    const { device_id, number, message, schedule } = req.body;

    const formData = new URLSearchParams();
    formData.append("device_id", device_id);
    formData.append("number", number);
    formData.append("message", message);
    formData.append("schedule", schedule);

    try {
        const response = await fetch("https://app.whacenter.com/api/send", {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error("Error sending request to WhaCenter:", error);
        res.status(500).json({ error: "Failed to send request to WhaCenter" });
    }
});

// Proxy endpoint to bypass CORS
app.post('/api/proxy/send', async (req, res) => {
    try {
        const response = await fetch('https://app.whacenter.com/api/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error("Error in proxy request:", error);
        res.status(500).json({ error: 'Failed to forward request to WhaCenter API' });
    }
});
// Route to log sent messages
app.post('/api/message-logs', (req, res) => {
    const { message, file_path, sent_to, time_sent } = req.body;

    const query = `
        INSERT INTO message_logs (message, file_path, sent_to, time_sent)
        VALUES (?, ?, ?, ?)
    `;

    db.run(query, [message, file_path, sent_to, time_sent], function (err) {
        if (err) {
            console.error('Failed to log message:', err.message);
            res.status(500).json({ error: 'Failed to log message.' });
        } else {
            console.log(`Message log added with ID: ${this.lastID}`);
            res.status(201).json({ id: this.lastID });
        }
    });
});

// Route to fetch message logs
app.get('/api/message-logs', (req, res) => {
    const query = 'SELECT * FROM message_logs';

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching message logs:', err.message);
            res.status(500).json({ error: 'Failed to load message logs.' });
        } else {
            console.log('Message logs fetched successfully:', rows);
            res.json(rows);
        }
    });
});

app.get('/api/get-inventory', async (req, res) => {
    try {
        // Code to load data from Google Sheets (like `loadMultipleSheetData`) and format it as JSON
        const inventoryData = await loadInventoryFromSheets(); // Define this function or reuse existing logic
        res.status(200).json(inventoryData);
    } catch (error) {
        console.error("Error fetching inventory data:", error);
        res.status(500).json({ error: "Failed to load inventory data." });
    }
});


app.post('/api/store-inventory', (req, res) => {
    const data = req.body;

    // Clear the existing inventory table to avoid duplicate entries
    db.run('DELETE FROM inventory', (err) => {
        if (err) {
            console.error('Failed to clear inventory table:', err.message);
            return res.status(500).json({ error: 'Failed to clear inventory table.' });
        }

        // Insert the new data
        const query = 'INSERT INTO inventory (nama_produk, modal) VALUES (?, ?)';
        const insertPromises = data.map(item => {
            return new Promise((resolve, reject) => {
                db.run(query, [item.nama_produk, item.modal], (err) => {
                    if (err) {
                        console.error('Error inserting inventory item:', err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });

        // Execute all insertions and respond to the client
        Promise.all(insertPromises)
            .then(() => {
                res.status(200).json({ message: 'Data stored successfully!' });
            })
            .catch(error => {
                console.error('Error during data insertion:', error);
                res.status(500).json({ error: 'Failed to store data.' });
            });
    });
});

// Endpoint to update SQL database and notify clients
app.post('/api/update-sql', (req, res) => {
    const { name, modal } = req.body;
    const query = 'UPDATE inventory SET modal = ? WHERE nama_produk = ?';
    db.run(query, [modal, name], function(err) {
        if (err) {
            console.error('Failed to update inventory:', err.message);
            res.status(500).json({ error: 'Failed to update inventory.' });
        } else {
            notifyClients(); // Notify clients of the update
            res.status(200).json({ message: 'Inventory updated successfully.' });
        }
    });
});

// Endpoint to update Google Sheets and notify clients
app.post('/api/update-sheet', async (req, res) => {
    const { range, values } = req.body;
    try {
        const authClient = await auth.getClient();
        await sheets.spreadsheets.values.update({
            auth: authClient,
            spreadsheetId: '1QGCYIOxBKEe9G0FduPmmL4PvqiiAXOGHWfW2PYz74M0',
            range: range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[values]] }
        });
        
        notifyClients(); // Notify clients of the update
        res.status(200).json({ message: 'Sheet updated successfully!' });
    } catch (error) {
        console.error('Error updating Google Sheets:', error);
        res.status(500).json({ error: 'Failed to update Google Sheets' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
