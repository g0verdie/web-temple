document.addEventListener('DOMContentLoaded', () => {
    if (!window.driver) {
        console.warn('driver.js library not loaded - onboarding tour unavailable');
        // Gracefully degrade: notify users but don't break the page
        const replayBtn = document.getElementById('replay-tour-btn');
        if (replayBtn) {
            const tourCard = replayBtn.closest('.card');
            if (tourCard) {
                tourCard.style.opacity = '0.6';
            }
        }
        return;
    }

    const driver = window.driver.js.driver;

    const tourSteps = [
        {
            element: '.site-title',
            popover: {
                title: 'Welcome to your Dashboard',
                description: 'This quick tour will show you the key features available to you as a Rabbi.',
                side: "bottom",
                align: 'start'
            }
        },
        {
            element: '#tour-announcements',
            popover: {
                title: 'Post Announcements',
                description: 'Use this to quickly broadcast messages and alerts to the congregation.',
                side: "top",
                align: 'start'
            }
        },
        {
            element: '#tour-calendar',
            popover: {
                title: 'Manage Calendar',
                description: 'Add, edit, or remove events related to the temple and public holidays.',
                side: "top",
                align: 'start'
            }
        },
        {
            element: '#tour-messages',
            popover: {
                title: 'Message Inbox',
                description: 'View and respond to direct messages from community members.',
                side: "top",
                align: 'start'
            }
        },
        {
            element: '#replay-tour-btn',
            popover: {
                title: 'Replay Anytime',
                description: 'You can replay this tour anytime by clicking here. Enjoy your new dashboard!',
                side: "left",
                align: 'center'
            }
        }
    ];

    const markOnboardingComplete = async () => {
        try {
            const csrfMeta = document.querySelector('meta[name="csrf-token"]');
            const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';

            const response = await fetch('/api/users/onboarding/complete', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                }
            });

            if (response.ok) {
                window.USER_ONBOARDING_COMPLETE = true;
                console.log('Onboarding marked as complete');
            } else {
                console.error('Failed to mark onboarding as complete');
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
        }
    };

    // Add keyboard accessibility: Escape key closes tour
    const tourKeydownHandler = (e) => {
        if (e.key === 'Escape' || e.code === 'Escape') {
            e.preventDefault();
            driverObj.destroy();
            // Note: marking onboarding complete on escape is handled by onDestroyStarted
        }
    };

    // Keep track of whether handler is attached
    let handlerAttached = false;

    const attachKeydown = () => {
        if (!handlerAttached) {
            document.addEventListener('keydown', tourKeydownHandler);
            handlerAttached = true;
        }
    };

    const detachKeydown = () => {
        if (handlerAttached) {
            document.removeEventListener('keydown', tourKeydownHandler);
            handlerAttached = false;
        }
    };

    const driverObj = driver({
        showProgress: true,
        steps: tourSteps,
        onDestroyStarted: () => {
            if (!driverObj.hasNextStep() || confirm("Are you sure you want to exit the tour?")) {
                driverObj.destroy();
                detachKeydown();
                // Mark complete if not already marked
                if (!window.USER_ONBOARDING_COMPLETE) {
                    markOnboardingComplete();
                }
            }
        }
    });

    // Start tour automatically if not complete
    if (!window.USER_ONBOARDING_COMPLETE) {
        // Small delay to ensure UI is ready
        setTimeout(() => {
            driverObj.drive();
            attachKeydown();
        }, 500);
    }

    // Bind replay button
    const replayBtn = document.getElementById('replay-tour-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            driverObj.drive();
            attachKeydown();
        });
    }

    // Listen for tour destruction to clean up keyboard handler
    window.addEventListener('beforeunload', () => {
        detachKeydown();
    });
});
