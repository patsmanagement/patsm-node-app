document.addEventListener("DOMContentLoaded", () => {
    const addBroadcastBtn = document.getElementById("add-broadcast-btn");
    const broadcastModal = document.getElementById("broadcast-modal");
    const closeBroadcastModal = document.getElementById("close-broadcast-modal");
    const broadcastForm = document.getElementById("broadcast-form");
    const sendToDropdown = document.getElementById("send-to");
    const broadcastTableBody = document.getElementById("broadcast-table-body");

    let broadcasts = []; // Store broadcasts for filtering
    
   // Function to load broadcasts from the server
   async function fetchBroadcasts() {
    try {
        const response = await fetch("http://localhost:3000/api/broadcasts");
        if (response.ok) {
            broadcasts = await response.json();
            displayBroadcasts(broadcasts);
        } else {
            console.error("Failed to load broadcasts:", response.statusText);
        }
    } catch (error) {
        console.error("Error loading broadcasts:", error);
    }
}

// Function to display broadcasts in the table
function displayBroadcasts(broadcastList) {
    console.log("Displaying broadcasts:", broadcastList); // Log the broadcast list to ensure it's being called
    broadcastTableBody.innerHTML = "";

    if (broadcastList.length === 0) {
        broadcastTableBody.innerHTML = `<tr><td colspan="6" class="no-data">No available broadcast template</td></tr>`;
    } else {
        broadcastList.forEach(broadcast => {
            const row = `
            <tr data-id="${broadcast.id}">
                <td>${broadcast.template_name}</td>
                <td>${broadcast.message}</td>
                <td>${broadcast.file_path ? `<a href="${broadcast.file_path}" target="_blank">View File</a>` : 'No File'}</td>
                <td>${broadcast.schedule}</td>
                <td>${broadcast.send_to}</td>
                <td class="broadcast-action-buttons">
                    <button class="broadcast-send-btn">Send</button>
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </td>
            </tr>`;
            console.log("Generated row HTML:", row); // Log each generated row
            broadcastTableBody.insertAdjacentHTML('beforeend', row);
        });

        // Add event listeners for Send, Edit, and Delete buttons
        document.querySelectorAll('.broadcast-send-btn').forEach(button => {
            button.addEventListener('click', sendBroadcast, { once: true }); // This ensures each button only listens once
        });

        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', openEditModal);
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', deleteBroadcast);
        });
    }
}

// Function to filter broadcasts based on search term
function filterBroadcasts(searchTerm) {
    const filteredBroadcasts = broadcasts.filter(broadcast => 
        broadcast.template_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    displayBroadcasts(filteredBroadcasts);
}

// Attach event listener to the search box
document.getElementById("broadcast-search-box").addEventListener("input", (event) => {
    const searchTerm = event.target.value;
    filterBroadcasts(searchTerm);
});    

// Open the Edit Modal
function openEditModal(event) {
    const row = event.target.closest('tr');
    const id = row.getAttribute('data-id');

    // Populate modal fields with data from the selected row
    document.getElementById('edit-broadcast-id').value = id;
    document.getElementById('edit-template-name').value = row.children[0].textContent;
    document.getElementById('edit-message').value = row.children[1].textContent;
    document.getElementById('edit-schedule').value = row.children[3].textContent;

    const selectedSendTo = row.children[4].textContent;
    loadEditVariableGroups(selectedSendTo); // Populate dropdown with current value

    // Open the edit modal
    document.getElementById('edit-broadcast-modal').style.display = 'block';
}

// Handle Edit Form Submission
document.getElementById('edit-broadcast-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('edit-broadcast-id').value;
    const formData = new FormData(document.getElementById('edit-broadcast-form'));
    const fileInput = document.getElementById("edit-file-upload");

    // Format schedule field as "YYYY-MM-DD HH:mm:ss"
    const scheduleInput = document.getElementById("edit-schedule");
    const date = new Date(scheduleInput.value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = "00"; 

    const formattedSchedule = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    formData.set("schedule", formattedSchedule);

    if (fileInput.files.length > 0) {
        formData.append("file", fileInput.files[0]);
    }

    try {
        const response = await fetch(`http://localhost:3000/api/broadcasts/${id}`, {
            method: 'PUT',
            body: formData,
        });

        if (response.ok) {
            document.getElementById('edit-broadcast-modal').style.display = 'none';
            fetchBroadcasts(); // Reload broadcasts after editing
        } else {
            console.error("Failed to update broadcast:", response.statusText);
        }
    } catch (error) {
        console.error("Error updating broadcast:", error);
    }
});
    // Handle Delete Broadcast
    async function deleteBroadcast(event) {
        const row = event.target.closest('tr');
        const id = row.getAttribute('data-id');

        if (confirm("Are you sure you want to delete this broadcast?")) {
            try {
                const response = await fetch(`http://localhost:3000/api/broadcasts/${id}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    alert("Broadcast deleted successfully!");
                    loadBroadcasts(); // Reload broadcasts
                } else {
                    console.error("Failed to delete broadcast:", response.statusText);
                    alert("Failed to delete broadcast.");
                }
            } catch (error) {
                console.error("Error deleting broadcast:", error);
                alert("Error deleting broadcast.");
            }
        }
    }

    async function sendBroadcast(event) {
        const row = event.target.closest('#broadcast-table-body tr');
        if (!row || !row.children[1] || !row.children[3] || !row.children[4]) {
            console.error("Necessary child elements not found:");
            return;
        }
    
        const message = row.children[1].textContent;
        const schedule = row.children[3].textContent;
        const sendTo = row.children[4].textContent;
        const scheduledDateTime = new Date(schedule.replace(" ", "T"));
        const formattedSchedule = scheduledDateTime.toISOString().replace("T", " ").slice(0, 19);
    
        try {
            const response = await fetch(`http://localhost:3000/api/contacts/by-variable?variable=${sendTo}`);
            if (!response.ok) throw new Error("Failed to fetch contacts");
    
            const contacts = await response.json();
            const numbers = contacts.map(contact => contact.number);
    
            for (const number of numbers) {
                const sendResponse = await fetch("http://localhost:3000/api/whacenter-send", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        device_id: "a66340b6d8c769d57e39ac69f92ee4d7",
                        number: number,
                        message: message,
                        schedule: formattedSchedule,
                    }),
                });
    
                const result = await sendResponse.json();
                if (!result.status) {
                    console.error(`Failed to schedule message for ${number}:`, result.message);
                }
    
                // Log the message to the database
                await fetch('http://localhost:3000/api/message-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        file_path: null,
                        sent_to: number,
                        time_sent: formattedSchedule,
                    }),
                });
            }
    
            alert("Broadcast messages have been scheduled successfully!");
        } catch (error) {
            console.error("Error scheduling broadcast:", error);
            alert("Error scheduling broadcast.");
        }
    }    
                                
    // Load variable groups into dropdown
    async function loadVariableGroups() {
        try {
            const response = await fetch("http://localhost:3000/api/variable-groups");
            if (response.ok) {
                const groups = await response.json();
                console.log("Groups fetched:", groups);

                sendToDropdown.innerHTML = ""; // Clear existing options

                const emptyOption = document.createElement("option");
                emptyOption.value = "";
                emptyOption.textContent = "-- Select Group --";
                sendToDropdown.appendChild(emptyOption);

                groups.forEach(group => {
                    const option = document.createElement("option");
                    option.value = group;
                    option.textContent = group;
                    sendToDropdown.appendChild(option);
                });
            } else {
                console.error("Failed to load variable groups:", response.statusText);
            }
        } catch (error) {
            console.error("Error loading variable groups:", error);
        }
    }

    // Load variable groups for the Edit Modal
async function loadEditVariableGroups(selectedValue = "") {
    try {
        const response = await fetch("http://localhost:3000/api/variable-groups");
        if (response.ok) {
            const groups = await response.json();
            console.log("Groups fetched for edit modal:", groups);

            const editSendToDropdown = document.getElementById("edit-send-to");
            editSendToDropdown.innerHTML = ""; // Clear existing options

            // Add an empty initial option
            const emptyOption = document.createElement("option");
            emptyOption.value = "";
            emptyOption.textContent = "-- Select Group --";
            editSendToDropdown.appendChild(emptyOption);

            // Populate the dropdown with fetched groups
            groups.forEach(group => {
                const option = document.createElement("option");
                option.value = group;
                option.textContent = group;
                if (group === selectedValue) {
                    option.selected = true; // Set selected if it matches the current value
                }
                editSendToDropdown.appendChild(option);
            });
        } else {
            console.error("Failed to load variable groups for edit modal:", response.statusText);
        }
    } catch (error) {
        console.error("Error loading variable groups for edit modal:", error);
    }
}


    // Open Add Modal and load variable groups
    addBroadcastBtn.addEventListener("click", () => {
        loadVariableGroups();
        broadcastModal.style.display = "block";
    });

    // Close Add Modal
    closeBroadcastModal.addEventListener("click", () => {
        broadcastModal.style.display = "none";
    });

    // Close the Edit Modal
document.getElementById('close-edit-modal').addEventListener('click', () => {
    document.getElementById('edit-broadcast-modal').style.display = 'none';
});


// Handle Add Form Submission
broadcastForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(broadcastForm);
    const fileInput = document.getElementById("file-upload");

    if (fileInput.files.length > 0) {
        formData.append("file", fileInput.files[0]);
    }

    try {
        const response = await fetch("http://localhost:3000/api/broadcasts", {
            method: "POST",
            body: formData,
        });
        if (response.ok) {
            document.getElementById('broadcast-modal').style.display = 'none';
            broadcastForm.reset();
            fetchBroadcasts(); // Replace loadBroadcasts() with fetchBroadcasts()        } else {
            console.error("Failed to add broadcast:", response.statusText);
        }
    } catch (error) {
        console.error("Error adding broadcast:", error);
    }
});

async function fetchBroadcasts() {
    try {
        const response = await fetch("http://localhost:3000/api/broadcasts");
        if (response.ok) {
            broadcasts = await response.json();
            console.log("Fetched broadcasts:", broadcasts); // Log the fetched data
            displayBroadcasts(broadcasts);
        } else {
            console.error("Failed to load broadcasts:", response.statusText);
        }
    } catch (error) {
        console.error("Error loading broadcasts:", error);
    }
}

    // Load broadcasts on page load
    fetchBroadcasts();
});
