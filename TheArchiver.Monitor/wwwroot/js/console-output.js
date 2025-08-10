// Console Output JavaScript functionality
window.setupBlazorInterop = function (dotNetRef) {
    // Set up keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        // Don't trigger shortcuts when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        if (e.code === 'Space') {
            e.preventDefault();
            dotNetRef.invokeMethodAsync('TogglePauseFromJS');
        } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyL') {
            e.preventDefault();
            dotNetRef.invokeMethodAsync('ClearLogsFromJS');
        } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
            e.preventDefault();
            const searchInput = document.querySelector('input[placeholder*="Search"]');
            if (searchInput) searchInput.focus();
        }
    });
    
    // Scroll to bottom function
    window.scrollToBottom = function (containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    };
    
    // Store the dotNetRef for later use
    window.blazorInterop = {
        dotNetRef: dotNetRef
    };
};

// Cleanup function
window.cleanupBlazorInterop = function () {
    if (window.blazorInterop && window.blazorInterop.dotNetRef) {
        window.blazorInterop.dotNetRef.dispose();
    }
};
