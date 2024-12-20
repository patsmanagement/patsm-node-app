async function loadMessageLogs() {
    try {
        const response = await fetch('http://localhost:3000/api/message-logs');
        if (!response.ok) throw new Error("Failed to load message logs");

        const logs = await response.json();
        const logTableBody = document.getElementById('log-table-body');
        
        if (logs.length === 0) {
            logTableBody.innerHTML = `<tr><td colspan="4">No messages found</td></tr>`;
        } else {
            logTableBody.innerHTML = logs.map(log => `
                <tr>
                    <td>${log.message}</td>
                    <td>${log.file_path ? `<a href="${log.file_path}" target="_blank">View File</a>` : 'No File'}</td>
                    <td>${log.sent_to}</td>
                    <td>${new Date(log.time_sent).toLocaleString()}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error("Error loading message logs:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadMessageLogs();
});
