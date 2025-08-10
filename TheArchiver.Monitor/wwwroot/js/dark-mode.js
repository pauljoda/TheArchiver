// Dark Mode Functionality for TheArchiver Monitor
window.darkModeManager = {
    
    // Initialize dark mode on page load
    init: function() {
        const storedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Determine initial theme
        let theme = storedTheme || (systemPrefersDark ? 'dark' : 'light');
        
        // Apply theme immediately to prevent flash
        this.applyTheme(theme);
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                // Only follow system if user hasn't manually set preference
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
        
        return theme;
    },
    
    // Apply theme to document
    applyTheme: function(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    },
    
    // Toggle theme
    toggle: function() {
        const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        this.applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        
        return newTheme;
    },
    
    // Get current theme
    getCurrentTheme: function() {
        return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    },
    
    // Set specific theme
    setTheme: function(theme) {
        this.applyTheme(theme);
        localStorage.setItem('theme', theme);
        return theme;
    },
    
    // Reset to system preference
    resetToSystem: function() {
        localStorage.removeItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const systemTheme = systemPrefersDark ? 'dark' : 'light';
        this.applyTheme(systemTheme);
        return systemTheme;
    }
};

// Initialize immediately when script loads
document.addEventListener('DOMContentLoaded', function() {
    window.darkModeManager.init();
});

// Also initialize immediately for faster loading
window.darkModeManager.init();