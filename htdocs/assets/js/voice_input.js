/**
 * Voice Input Logic
 * Manages Web Speech API and UI interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Voice recognition is not supported in this browser. Please use Chrome or Edge.");
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    // Configuration
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Optimized for Indian accents

    // State
    let isListening = false;
    let finalTranscript = '';
    let parsedItems = []; // {id: timestamp, sku: string, size: string}

    // Elements
    const micBtn = document.getElementById('micBtn');
    const statusText = document.getElementById('statusText');
    const transcriptEl = document.getElementById('transcript');
    const parsedListEl = document.getElementById('parsedList');
    const emptyState = document.getElementById('emptyState');
    const itemCountEl = document.getElementById('itemCount');
    const clearBtn = document.getElementById('clearBtn');
    const saveBtn = document.getElementById('saveBtn'); // Actually submit button
    const container = document.querySelector('.bg-white.rounded-2xl'); // Control card

    // Toggle Mic
    micBtn.addEventListener('click', () => {
        if (isListening) {
            isListening = false; // Manual stop
            recognition.stop();
        } else {
            // content reset? No, continuous session until explicit clear
            try {
                recognition.start();
            } catch (e) { console.error(e); }
        }
    });

    // Recognition Events
    recognition.onstart = () => {
        isListening = true;
        container.classList.add('mic-active');
        micBtn.innerHTML = '<i class="fas fa-stop"></i>';
        statusText.textContent = "Listening... Speak naturally";
        statusText.classList.add('text-indigo-600', 'animate-pulse');
    };

    recognition.onend = () => {
        // Auto-restart if we are supposed to be listening
        if (isListening) {
            console.log("Recognition stopped (timeout/silence), restarting...");
            try {
                recognition.start();
            } catch (e) { console.error("Auto-restart failed", e); }
            return; // Don't reset UI yet
        }

        container.classList.remove('mic-active');
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        statusText.textContent = "Tap to Start";
        statusText.classList.remove('text-indigo-600', 'animate-pulse');
    };

    recognition.onerror = (event) => {
        console.error('Speech error', event.error);

        // Ignore non-fatal errors
        if (event.error === 'no-speech' || event.error === 'network') {
            // Keep listening state true so onend restarts it
            statusText.textContent = "Listening... (Silence/Network)";
            return;
        }

        if (event.error === 'not-allowed') {
            alert("Microphone access denied.");
            isListening = false; // Stop trying
        } else if (event.error === 'aborted') {
            // User stopped manually or another instance took over?
            // If manual stop, isListening would be false.
            // If we are still listening, restart.
        } else {
            statusText.textContent = "Error: " + event.error;
        }
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
                processFinalText(event.results[i][0].transcript);
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        // Update raw transcript view
        // Show last ~100 chars of final + interim
        const display = (finalTranscript + ' ' + interimTranscript).slice(-200);
        transcriptEl.textContent = display || '...';

        // Optional: Run parser on interim for live feedback (visual only?)
        // Might be jumpy. Let's stick to processing final text chunks.
    };

    // Processing
    function processFinalText(text) {
        // Use VoiceUtils to parse
        const result = VoiceUtils.parseTranscript(text);

        if (result.pairs.length > 0) {
            result.pairs.forEach(pair => {
                addItem(pair.sku, pair.size);
            });
        }
    }

    // Audio Feedback
    function playBuzzer() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';      // key for buzzer sound
            osc.frequency.value = 650;
            gain.gain.value = 0.25;   // steady volume
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    }

    let itemBuffer = ""; // Accumulates normalized text that hasn't formed a pair yet

    function processFinalText(text) {
        const normalized = VoiceUtils.normalizeText(text);
        if (!normalized) return;

        // Append to buffer with space
        itemBuffer = (itemBuffer + " " + normalized).trim();

        // Tokenize buffer
        const tokens = itemBuffer.split(/\s+/);
        const validSizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

        let localSkuBuffer = [];
        let newPairs = [];

        // Iterate tokens
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const upper = token.toUpperCase();

            if (validSizes.includes(upper)) {
                // Size Found!
                // Prior tokens are SKU
                if (localSkuBuffer.length > 0) {
                    const sku = localSkuBuffer.join('').toUpperCase();
                    // Validation: 3 digits (101-999) or 4 digits (5001-9999)
                    const skuNum = parseInt(sku, 10);
                    const isValid = !isNaN(skuNum) && (
                        (skuNum >= 101 && skuNum <= 999) ||
                        (skuNum >= 5001 && skuNum <= 9999)
                    );

                    if (isValid) {
                        addItem(sku, upper, false);
                    } else {
                        playBuzzer();
                        addItem(sku, upper, true); // Mark as error
                    }
                }
                // Reset local buffer
                localSkuBuffer = [];
                // We have "consumed" up to this point. 
                // So the `itemBuffer` should essentially be truncated to "after this point".
                // We'll reconstruct `itemBuffer` from the *remaining* loop iterations?
                // Actually, just resetting localSkuBuffer is enough for the loop.
                // At the end of loop, `localSkuBuffer` contains the "leftover".
            } else {
                localSkuBuffer.push(token);
            }
        }

        // Update itemBuffer to be only the leftover SKU parts
        itemBuffer = localSkuBuffer.join(' ');
        console.log("Buffer state:", itemBuffer);
    }

    // UI Functions
    function addItem(sku, size, isError = false) {
        // Remove previous error item if it exists at the top
        if (parsedItems.length > 0 && parsedItems[0].isError) {
            removeItem(parsedItems[0].id);
        }

        // Prevent duplicates? Maybe allow duplicates for counting? Use timestamp ID.
        const id = Date.now() + Math.random().toString(16).slice(2);

        const item = { id, sku, size, isError };
        parsedItems.unshift(item); // Newest top

        // visual update
        renderItem(item);
        updateState();
    }

    function renderItem(item) {
        const template = document.getElementById('itemTemplate');
        const clone = template.content.cloneNode(true);
        const el = clone.querySelector('.parsed-item');

        el.dataset.id = item.id;
        el.querySelector('.sku-text').textContent = item.sku;
        el.querySelector('.size-badge').textContent = item.size;

        if (item.isError) {
            el.classList.remove('border-gray-200');
            el.classList.add('border-red-500', 'bg-red-50');
            const badge = el.querySelector('.size-badge');
            badge.classList.remove('bg-indigo-50', 'text-indigo-600');
            badge.classList.add('bg-red-200', 'text-red-700');

            const skuText = el.querySelector('.sku-text');
            skuText.classList.add('text-red-700');
            skuText.textContent += " (Invalid)";
        }

        // Delete handler
        el.querySelector('.delete-btn').onclick = () => removeItem(item.id);

        parsedListEl.prepend(el);
    }

    function removeItem(id) {
        parsedItems = parsedItems.filter(i => i.id !== id);
        const el = parsedListEl.querySelector(`.parsed-item[data-id="${id}"]`);
        if (el) el.remove();
        updateState();
    }

    function updateState() {
        itemCountEl.textContent = parsedItems.length;
        if (parsedItems.length > 0) {
            emptyState.classList.add('hidden');
            saveBtn.disabled = false;
        } else {
            emptyState.classList.remove('hidden');
            saveBtn.disabled = true;
        }
    }

    clearBtn.onclick = () => {
        parsedItems = [];
        parsedListEl.innerHTML = '';
        parsedListEl.appendChild(emptyState);
        updateState();
        itemBuffer = "";
    };


    saveBtn.onclick = async () => {
        if (parsedItems.length === 0) return;

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        // Filter out items already marked invalid on client side
        const itemsToSave = parsedItems.filter(i => !i.isError);

        let successCount = 0;
        let failCount = 0;

        // Process sequentially to be safe (or parallel if prefer speed)
        for (const item of itemsToSave) {
            const el = parsedListEl.querySelector(`.parsed-item[data-id="${item.id}"]`);
            // Add a spinner or loading state to el?
            if (el) el.style.opacity = '0.5';

            try {
                const response = await fetch('api/inventory.php?action=increment_stock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sku_fragment: item.sku,
                        size: item.size,
                        quantity: 1
                    })
                });

                const data = await response.json();

                if (data.success) {
                    successCount++;
                    // Visual success
                    if (el) {
                        el.style.opacity = '1';
                        el.classList.add('bg-green-50', 'border-green-300');
                        // Change delete button to checkmark
                        const btn = el.querySelector('.delete-btn');
                        btn.innerHTML = '<i class="fas fa-check text-green-600"></i>';
                        btn.onclick = null; // Remove delete handler
                    }
                    // Remove from "active" parsedItems so they don't get resubmitted easily?
                    // Actually, we usually clear list on success.
                } else {
                    failCount++;
                    if (el) {
                        el.style.opacity = '1';
                        el.classList.add('bg-red-50', 'border-red-500');
                        el.querySelector('.sku-text').textContent += ` (${data.error || "Failed"})`;
                    }
                }
            } catch (err) {
                console.error("Save error", err);
                failCount++;
                if (el) {
                    el.style.opacity = '1';
                    el.classList.add('bg-red-50', 'border-red-500');
                    el.querySelector('.sku-text').textContent += " (Net Error)";
                }
            }
        }

        saveBtn.textContent = "Save to Database";
        saveBtn.disabled = false;

        if (failCount === 0) {
            // All good!
            // Wait a moment then clear
            setTimeout(() => {
                // Clear only successful ones? Or all?
                // Standard behavior: clear all if all success
                clearBtn.click();
                alert(`Successfully added ${successCount} items to inventory.`);
            }, 1000);
        } else {
            alert(`Saved ${successCount} items. ${failCount} failed. Please check the list.`);
            // remove successful items from parsedItems array so valid ones are gone?
            // Re-sync parsedItems list? 
            // For now, simple alert is enough.
        }
    };

});
