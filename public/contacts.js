// Global variables
let contacts = []; // Store contact list
let filteredContacts = []; // Store filtered contacts from search
let currentPage = 1;
const rowsPerPage = 5;

// Get modal and form elements
const addContactModal = document.getElementById('add-contact-modal');
const addContactForm = document.getElementById('add-contact-form');
const addBtn = document.getElementById('add-contact-btn');
const closeAddModalBtn = document.getElementById('close-add-modal');
const cancelAddBtn = document.getElementById('cancel-add-btn');

// Load contacts on page load
document.addEventListener('DOMContentLoaded', () => {
    loadContacts(); // Fetch contacts from the backend API
});

// Open Add Contact modal
addBtn.addEventListener('click', () => {
    addContactModal.style.display = 'block'; // Show modal
});

// Close Add Contact modal
closeAddModalBtn.addEventListener('click', () => {
    addContactModal.style.display = 'none'; // Hide modal
});

cancelAddBtn.addEventListener('click', () => {
    addContactModal.style.display = 'none'; // Hide modal
});

// Fetch contacts from the backend
function loadContacts() {
    fetch('http://localhost:3000/api/contacts')
        .then(response => response.json())
        .then(data => {
            contacts = data;
            filteredContacts = contacts; // Initialize filteredContacts
            displayContacts();
        })
        .catch(error => console.error('Error loading contacts:', error));
}

// Add this function near the top
function filterContacts(searchTerm) {
    filteredContacts = contacts.filter(contact => contact.name.toLowerCase().includes(searchTerm));
    displayContacts();
}

// Modify the existing displayContacts function to match this updated version
function displayContacts() {
    const tableBody = document.getElementById('contact-table-body');
    tableBody.innerHTML = ''; // Clear the table

    const start = (currentPage - 1) * rowsPerPage;
    const paginatedContacts = filteredContacts.slice(start, start + rowsPerPage);

    if (paginatedContacts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="no-data">No available contact</td></tr>`;
    } else {
        paginatedContacts.forEach((contact, index) => {
            const row = `
                <tr>
                    <td>${contact.name}</td>
                    <td>${contact.number}</td>
                    <td>${contact.variable}</td>
                    <td>
                        <button class="send-btn" onclick="openSendMessageModal(${index})">Send</button>
                        <button class="edit-btn" onclick="openEditModal(${index})">Edit</button>
                        <button class="delete-btn" onclick="confirmDelete(${index})">Delete</button>
                    </td>
                </tr>`;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
    }
    updatePaginationControls();
}

// Event listener for the search box
document.getElementById("search-box").addEventListener("input", (event) => {
    const searchTerm = event.target.value.toLowerCase(); // Get the search term in lowercase
    filterContacts(searchTerm); // Call filter function with search term
});

// Update pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(filteredContacts.length / rowsPerPage);
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prev-btn').disabled = currentPage === 1;
    document.getElementById('next-btn').disabled = currentPage === totalPages;
}

// Navigate pages
function nextPage() {
    if (currentPage < Math.ceil(filteredContacts.length / rowsPerPage)) {
        currentPage++;
        displayContacts();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayContacts();
    }
}

// Open the Send Message Modal with correct contact info
function openSendMessageModal(index) {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const contact = filteredContacts[startIndex + index];

    if (!contact) {
        console.error('Contact not found.');
        return;
    }

    console.log('Selected contact:', contact); // Debugging

    // Set the contact info without resetting it on subsequent open actions
    document.getElementById('contact-name').value = contact.name || 'N/A';
    document.getElementById('contact-number').value = contact.number || 'N/A';

    const sendMessageModal = document.getElementById('send-message-modal');
    sendMessageModal.style.display = 'block'; // Show the modal

    // Ensure only the message and success message are reset
    resetSendMessageModal();
}

// Close the Send Message Modal and reset only necessary fields
document.getElementById('close-send-message-modal').addEventListener('click', () => {
    document.getElementById('send-message-modal').style.display = 'none'; // Hide modal
    resetSendMessageModal(); // Reset the form when closing
});

// Handle the Send Message form submission
document.getElementById('send-message-form').addEventListener('submit', (event) => {
    event.preventDefault(); // Prevent page reload

    const message = document.getElementById('message-content').value;
    const contactNumber = document.getElementById('contact-number').value;

    if (!message || !contactNumber) {
        alert('Please enter a message and ensure contact info is available.');
        return;
    }

    // Simulate sending message using the WhaCenter API
    fetch('http://localhost:3000/api/proxy/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            device_id: 'a66340b6d8c769d57e39ac69f92ee4d7',
            number: contactNumber,
            message: message,
        }),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Message sent:', data);

        // Log the message to the database
        return fetch('http://localhost:3000/api/message-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                file_path: null,
                sent_to: contactNumber,
                time_sent: new Date().toISOString(),
            }),
        });
    })
    .then(logResponse => logResponse.json())
    .then(logData => {
        console.log('Message log saved:', logData);
        alert("Message sent and logged successfully.");
        
        // Automatically close the send message modal
        document.getElementById('send-message-modal').style.display = 'none';
        resetSendMessageModal(); // Reset the form for future use
    })
    .catch(error => console.error('Error sending or logging message:', error));
}, { once: true });  // Ensures event fires only once

// Function to reset only the message content and success message
function resetSendMessageModal() {
    document.getElementById('send-message-form').style.display = 'block'; // Show the form
    document.getElementById('success-message').style.display = 'none'; // Hide the success message

    // Clear only the message content, leaving the contact info intact
    document.getElementById('message-content').value = '';
}

// Add new contact via the modal form
addContactForm.addEventListener('submit', function (event) {
  event.preventDefault(); // Prevent the default form submission

  const name = document.getElementById('add-name').value.trim();
  const number = document.getElementById('add-number').value.trim();
  const variable = document.getElementById('add-variable').value.trim();

  // Validate input to ensure all fields are filled
  if (!name || !number || !variable) {
      alert('Please fill in all the fields.');
      return;
  }

 // Send the new contact to the backend API
 fetch('http://localhost:3000/api/contacts', {  // Ensure correct URL and port
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, number, variable })
})
.then(response => {
  if (!response.ok) throw new Error(`Failed to add contact: ${response.statusText}`);
  return response.json();
})
.then(data => {
  console.log('Contact added:', data); // Log the response for verification
  contacts.push({ id: data.id, name, number, variable });
  displayContacts(); // Refresh the contact list
  addContactModal.style.display = 'none'; // Close the modal
  addContactForm.reset(); // Reset the form
})
.catch(error => console.error('Error adding contact:', error));
});

// Handle Import Contact button click
document.getElementById('import-contact-btn').addEventListener('click', () => {
    document.getElementById('file-upload').click(); // Trigger hidden file input
});

// Upload the selected file to the backend
document.getElementById('file-upload').addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('file', file);

        fetch('http://localhost:3000/api/import-contacts', {
            method: 'POST',
            body: formData,
        })
            .then((response) => response.json())
            .then((data) => {
                alert(data.message); // Show success message
                loadContacts(); // Reload contacts from backend
            })
            .catch((error) => console.error('Error importing contacts:', error));
    }
});


// Delete a contact via API
function confirmDelete(index) {
    const contact = contacts[index];
    if (confirm(`Are you sure you want to delete ${contact.name}?`)) {
        fetch(`http://localhost:3000/api/contacts/${contact.id}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to delete contact');
            contacts.splice(index, 1);
            displayContacts();
        })
        .catch(error => console.error('Error deleting contact:', error));
    }
}

// Open Edit Contact modal
function openEditModal(index) {
    const contact = contacts[index];

    document.getElementById('edit-name').value = contact.name;
    document.getElementById('edit-number').value = contact.number;
    document.getElementById('edit-variable').value = contact.variable;

    const editModal = document.getElementById('edit-modal');
    editModal.style.display = 'block';

    document.getElementById('edit-contact-form').onsubmit = function(event) {
        event.preventDefault();
        updateContact(index);
    };
}

function updateContact(index) {
    const contact = contacts[index];
    const name = document.getElementById('edit-name').value;
    const number = document.getElementById('edit-number').value;
    const variable = document.getElementById('edit-variable').value;

    fetch(`http://localhost:3000/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, number, variable })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to update contact');
        contacts[index] = { id: contact.id, name, number, variable };
        displayContacts();
        document.getElementById('edit-modal').style.display = 'none';
    })
    .catch(error => console.error('Error updating contact:', error));
}

// Update contact via API
function updateContact(index) {
    const contact = contacts[index];
    const name = document.getElementById('edit-name').value;
    const number = document.getElementById('edit-number').value;
    const variable = document.getElementById('edit-variable').value;

    fetch(`http://localhost:3000/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, number, variable })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to update contact');
        contacts[index] = { id: contact.id, name, number, variable };
        displayContacts();
        document.getElementById('edit-modal').style.display = 'none';
    })
    .catch(error => console.error('Error updating contact:', error));
}

// Added: Close Add Contact modal
document.getElementById('close-add-modal').addEventListener('click', () => {
    document.getElementById('add-contact-modal').style.display = 'none'; // Hide the modal
});

// Added: Close Edit Contact modal
const closeEditModalBtn = document.querySelector('#edit-modal .close');
closeEditModalBtn.addEventListener('click', () => {
    document.getElementById('edit-modal').style.display = 'none'; // Hide the modal
});

// Added: Cancel button in Add Contact modal
document.getElementById('cancel-add-btn').addEventListener('click', () => {
    document.getElementById('add-contact-modal').style.display = 'none'; // Hide the modal
});


// Added: Close modal if clicked outside
window.addEventListener('click', (event) => {
    const addModal = document.getElementById('add-contact-modal');
    const editModal = document.getElementById('edit-modal');
    if (event.target === addModal) addModal.style.display = 'none'; // Hide add modal
    if (event.target === editModal) editModal.style.display = 'none'; // Hide edit modal
});