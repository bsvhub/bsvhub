// count.js - Visitor counter loader
(function() {
    function loadCounter() {
        const counterSpan = document.getElementById('visit-counter');
        if (counterSpan) {
            const script = document.createElement('script');
            script.src = 'https://counter.websiteout.com/js/7/6/0/0';
            counterSpan.appendChild(script);
        } else {
            // Element not ready yet, try again soon
            setTimeout(loadCounter, 100);
        }
    }
    
    // Start checking after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadCounter);
    } else {
        loadCounter();
    }
})();