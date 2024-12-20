const sheetRanges = [
    'BnR!B4:C', 'SAYURAN!B4:C', 'RIMPANGAN!B4:C', 'REMPAH&BEAN!B4:C',
    'DRY&POWDER!B4:C', 'TTnJ!B4:C', 'BUAH!B4:C', 'PRODUK!B4:C', 'UKM!B4:D'
];

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("inventory-search-box").addEventListener("input", filterInventoryTable);
});

let ws;

function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8080');
    
    // Listen for WebSocket messages
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket message on client:", data);
        if (data.message === 'Data updated') {
            console.log('Data update detected, fetching new data...');
            loadMultipleSheetData(); // Call to refresh data on update
        }
    };

    // Handle connection close and attempt to reconnect
    ws.onclose = () => {
        console.warn("WebSocket closed, attempting to reconnect...");
        setTimeout(connectWebSocket, 1000); // Try reconnecting after 1 second
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
    };
}

// Establish WebSocket connection initially
connectWebSocket();

let lastFetchedData = null; // Cache for last fetched data
let currentCellLocation; // Store cell location for the row being edited

function filterInventoryTable() {
    const searchTerm = document.getElementById("inventory-search-box").value.toLowerCase();
    const tbody = document.querySelector("table.styled-table tbody");
    const rows = tbody.getElementsByTagName("tr");

    Array.from(rows).forEach(row => {
        const productName = row.cells[0].textContent.toLowerCase();
        if (productName.includes(searchTerm)) {
            row.style.display = ""; // Show matching row
        } else {
            row.style.display = "none"; // Hide non-matching row
        }
    });
}


function initializeGoogleSheetsAPI() {
    console.log("Initializing Google Sheets API...");

    gapi.load("client", () => {
        gapi.client.init({
            apiKey: "AIzaSyCK2RONfp3EOy62390uzZmaFGBoEI5PSqw",
            discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
        }).then(() => {
            console.log("Google Sheets API initialized.");
            loadMultipleSheetData(); // Initial load
        }).catch(error => console.error("Error initializing Google Sheets API:", error));
    });
}

function loadMultipleSheetData() {
    console.log("Fetching updated data from Google Sheets...");

    gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: '1QGCYIOxBKEe9G0FduPmmL4PvqiiAXOGHWfW2PYz74M0',
        ranges: sheetRanges,
    }).then(response => {
        console.log("Updated data fetched from Google Sheets:", response.result.valueRanges);

        // Clear and populate table
        const tbody = document.querySelector("table.styled-table tbody");
        tbody.innerHTML = ""; // Clear existing rows
        console.log("Cleared table contents.");

        response.result.valueRanges.forEach((rangeData, sheetIndex) => {
            const rows = rangeData.values;
            const sheetName = sheetRanges[sheetIndex].split('!')[0];

            if (rows && rows.length) {
                rows.forEach((row, rowIndex) => {
                    const tr = document.createElement("tr");

                    // Handle "Nama Produk" column (column B in Google Sheets)
                    const nameTd = document.createElement("td");
                    nameTd.textContent = row[0] || ""; // First column (index 0)
                    tr.appendChild(nameTd);

                    // Handle "Modal" column: Use column D for UKM, otherwise column C
                    const modalValue = sheetName === 'UKM' ? (row[2] || 0) : (row[1] || 0); // Index 2 for D, 1 for C
                    const modalTd = document.createElement("td");
                    modalTd.innerHTML = `
                        Rp <span class="modal-value">${modalValue}</span>
                        <span class="edit-icon" onclick="openEditModal('${row[0]}', ${modalValue}, '${sheetName}!${sheetName === 'UKM' ? 'D' : 'C'}${4 + rowIndex}')">
                            <img src="/images/edit-icon-harga-modal.png" alt="Edit">
                        </span>
                    `;
                    tr.appendChild(modalTd);

                    // Add other columns (Offline, Online, Stock) as placeholders
                    ["-", "-", "-"].forEach(content => {
                        const otherTd = document.createElement("td");
                        otherTd.textContent = content;
                        tr.appendChild(otherTd);
                    });

                    tbody.appendChild(tr);
                });
                console.log(`Populated table with data from sheet: ${sheetName}`);
            }
        });

    }).catch(error => console.error("Error fetching updated data:", error));
}

function openEditModal(namaProduk, currentPrice, cellLocation) {
    document.getElementById("modalNamaProduk").textContent = namaProduk;
    const modalPriceInput = document.getElementById("modalPrice");
    modalPriceInput.value = parseFloat(currentPrice).toFixed(0);
    document.getElementById("editModal").style.display = "flex";

    // Store cell location for use in saveModal
    currentCellLocation = cellLocation;

    // Add 'Enter' key listener
    modalPriceInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            saveModal(); // Trigger save action
            event.preventDefault(); // Prevent any default action
        }
    });
}

function closeEditModal() {
    document.getElementById("editModal").style.display = "none";
}

function saveModal() {
    const newPrice = parseInt(document.getElementById("modalPrice").value, 10);
    const productName = document.getElementById("modalNamaProduk").textContent;

    console.log("Updating cell location:", currentCellLocation, "with value:", newPrice);

    // Update Google Sheets
    fetch('/api/update-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: currentCellLocation, values: newPrice })
    })
        .then(response => {
            if (response.ok) {
                console.log("Google Sheets updated successfully.");
            } else {
                console.error("Failed to update Google Sheets.");
            }
        })
        .catch(error => console.error("Error updating Google Sheets:", error));

    // Update SQL database
    fetch('/api/update-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: productName, modal: newPrice }) // assuming name is unique key
    })
        .then(response => {
            if (response.ok) {
                console.log("SQL Database updated successfully.");
            } else {
                console.error("Failed to update SQL Database.");
            }
        })
        .catch(error => console.error("Error updating SQL Database:", error));

    closeEditModal();
}