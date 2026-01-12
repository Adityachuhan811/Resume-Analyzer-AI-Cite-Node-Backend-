// public/app.js

// Handle Upload
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.textContent = 'Uploading and processing...';
    
    const formData = new FormData();
    formData.append('name', document.getElementById('name').value);
    formData.append('email', document.getElementById('email').value);
    formData.append('file', document.getElementById('file').files[0]);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (response.ok) {
            statusDiv.innerHTML = `<span style="color:green">Success! Resume ID: ${result.id} saved.</span>`;
            document.getElementById('uploadForm').reset();
        } else {
            statusDiv.innerHTML = `<span style="color:red">Error: ${result.error}</span>`;
        }
    } catch (err) {
        statusDiv.innerHTML = `<span style="color:red">Network Error: ${err.message}</span>`;
    }
});

// Handle Search
async function searchResumes() {
    const query = document.getElementById('searchQuery').value;
    const resultsDiv = document.getElementById('searchResults');
    
    if (!query) {
        alert("Please enter a job description");
        return;
    }

    resultsDiv.innerHTML = 'Searching...';

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, top_k: 5 })
        });

        const results = await response.json();
        
        if (results.length === 0) {
            resultsDiv.innerHTML = '<p>No matches found.</p>';
            return;
        }

        const html = results.map(r => `
            <div class="result-item">
                <span class="score">Match: ${(r.score * 100).toFixed(1)}%</span>
                <strong>${r.name}</strong> (${r.email})<br>
                <small>File: ${r.fileName || 'N/A'}</small>
                <p style="color:#555; font-size:0.9em;">"${r.snippet}"</p>
            </div>
        `).join('');
        
        resultsDiv.innerHTML = html;

    } catch (err) {
        resultsDiv.innerHTML = `<p style="color:red">Search Failed: ${err.message}</p>`;
    }
}