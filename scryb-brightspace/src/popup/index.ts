/// <reference types="chrome"/>

document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
    const statusDiv = document.createElement("div");
    statusDiv.id = "status";
    statusDiv.style.marginTop = "10px";
    document.body.appendChild(statusDiv);
    
    // Add a progress indicator
    const progressDiv = document.createElement("div");
    progressDiv.id = "progress";
    progressDiv.style.marginTop = "15px";
    document.body.appendChild(progressDiv);
    
    // Add a results section
    const resultsDiv = document.createElement("div");
    resultsDiv.id = "results";
    resultsDiv.style.marginTop = "15px";
    resultsDiv.style.display = "none";
    document.body.appendChild(resultsDiv);
    
    function updateStatus(message: string, isError = false) {
      statusDiv.textContent = message;
      statusDiv.style.color = isError ? "red" : "green";
      console.log(isError ? "ERROR: " : "STATUS: ", message);
    }
    
    function updateProgress(step: number, total: number, message: string) {
      const percent = Math.round((step / total) * 100);
      progressDiv.innerHTML = `
        <div style="width:100%; background-color:#f0f0f0; border-radius:4px; margin-bottom:5px;">
          <div style="width:${percent}%; background-color:#4285f4; height:10px; border-radius:4px;"></div>
        </div>
        <div>${message} (${step}/${total})</div>
      `;
    }
    
    function showResults(processedLinks: Array<{title: string, url: string, status: string}>) {
      resultsDiv.style.display = "block";
      resultsDiv.innerHTML = "<h3>Results:</h3>";
      
      // Count successes and failures
      const uploaded = processedLinks.filter(link => link.status === 'uploaded').length;
      const failed = processedLinks.filter(link => link.status.startsWith('error')).length;
      const skipped = processedLinks.filter(link => link.status.startsWith('skipped')).length;
      
      // Add summary
      const summary = document.createElement("div");
      summary.innerHTML = `
        <p>
          <strong>Total files:</strong> ${processedLinks.length}<br>
          <strong>Successfully uploaded:</strong> ${uploaded}<br>
          <strong>Failed:</strong> ${failed}<br>
          <strong>Skipped:</strong> ${skipped}
        </p>
      `;
      resultsDiv.appendChild(summary);
      
      // Add table with details
      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      
      // Add header row
      const headerRow = document.createElement("tr");
      ["Title", "Status"].forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        th.style.textAlign = "left";
        th.style.padding = "5px";
        th.style.borderBottom = "1px solid #ddd";
        headerRow.appendChild(th);
      });
      table.appendChild(headerRow);
      
      // Add data rows
      processedLinks.forEach(link => {
        const row = document.createElement("tr");
        
        const titleCell = document.createElement("td");
        titleCell.textContent = link.title;
        titleCell.style.padding = "5px";
        titleCell.style.borderBottom = "1px solid #ddd";
        row.appendChild(titleCell);
        
        const statusCell = document.createElement("td");
        statusCell.textContent = link.status;
        statusCell.style.padding = "5px";
        statusCell.style.borderBottom = "1px solid #ddd";
        statusCell.style.color = link.status === 'uploaded' ? "green" : "red";
        row.appendChild(statusCell);
        
        table.appendChild(row);
      });
      
      resultsDiv.appendChild(table);
      
      // Add a "Done" button
      const doneBtn = document.createElement("button");
      doneBtn.textContent = "Done";
      doneBtn.style.marginTop = "10px";
      doneBtn.style.padding = "8px 16px";
      doneBtn.style.backgroundColor = "#4285f4";
      doneBtn.style.color = "white";
      doneBtn.style.border = "none";
      doneBtn.style.borderRadius = "4px";
      doneBtn.style.cursor = "pointer";
      
      doneBtn.addEventListener("click", () => {
        window.close();
      });
      
      resultsDiv.appendChild(doneBtn);
    }
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message) => {
      console.log("Popup received message:", message);
      
      if (message.action === "pdfLinksFound") {
        updateStatus(`Found ${message.count} PDF links`);
        updateProgress(2, 3, `Found ${message.count} PDF links`);
      } else if (message.action === "pdfProcessingProgress") {
        updateStatus(`Processing: ${message.title} (${message.current}/${message.total})`);
        updateProgress(2, 3, `Processing PDF ${message.current}/${message.total}`);
      } else if (message.action === "pdfProcessingComplete") {
        updateStatus("PDF processing complete");
        updateProgress(3, 3, "Complete");
        startBtn.disabled = false;
        
        // Show the results
        showResults(message.processedLinks);
      } else if (message.action === "pdfSearchComplete" && !message.success) {
        updateStatus(`PDF search failed: ${message.error}`, true);
        startBtn.disabled = false;
      } else if (message.action === "debugUrl") {
        // Create or update debug info section
        let debugDiv = document.getElementById("debugInfo");
        if (!debugDiv) {
          debugDiv = document.createElement("div");
          debugDiv.id = "debugInfo";
          debugDiv.style.marginTop = "15px";
          debugDiv.style.padding = "10px";
          debugDiv.style.border = "1px solid #ddd";
          debugDiv.style.backgroundColor = "#f8f8f8";
          document.body.appendChild(debugDiv);
        }
        
        // Add the URL as a clickable link
        debugDiv.innerHTML = `
          <h4>Debug Information:</h4>
          <p>Attempting to fetch: "${message.title}"</p>
          <p>URL: <a href="${message.url}" target="_blank">${message.url}</a></p>
          <p>Click the URL to open it in a new tab and check if authentication works</p>
        `;
      }
    });
    
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        startBtn.disabled = true;
        updateStatus("Starting process...");
        updateProgress(1, 3, "Checking page");
        
        // Hide the results section when starting a new process
        resultsDiv.style.display = "none";
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || tabs.length === 0) {
            updateStatus("No active tab found", true);
            startBtn.disabled = false;
            return;
          }
          
          const tab = tabs[0];
          if (!tab.id) {
            updateStatus("Tab ID not found", true);
            startBtn.disabled = false;
            return;
          }
          
          try {
            chrome.tabs.sendMessage(
              tab.id, 
              { action: "startProcess" },
              (response) => {
                if (chrome.runtime.lastError) {
                  updateStatus(`Error: ${chrome.runtime.lastError.message}`, true);
                  console.error("Runtime error:", chrome.runtime.lastError);
                  startBtn.disabled = false;
                  return;
                }
                
                if (response) {
                  console.log("Response from content script:", response);
                  
                  if (response.status === "navigate") {
                    updateStatus(response.message);
                    updateProgress(2, 3, "Navigating to content page");
                  } else if (response.status === "processing") {
                    updateStatus(response.message);
                    updateProgress(2, 3, "Processing PDF links");
                  } else if (response.status === "error") {
                    updateStatus(response.message, true);
                    startBtn.disabled = false;
                  }
                } else {
                  updateStatus("No response from content script", true);
                  startBtn.disabled = false;
                }
              }
            );
          } catch (error) {
            updateStatus(`Exception: ${error}`, true);
            console.error("Exception:", error);
            startBtn.disabled = false;
          }
        });
      });
    } else {
      updateStatus("Start button not found", true);
    }
  });
    