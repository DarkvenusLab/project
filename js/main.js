/**
 * DarkVenus Lab - Interactive Scripts
 */

function toggleDetails(elementId) {
  const target = document.getElementById(elementId);
  if (target) {
    target.classList.toggle('hidden');
  }
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;
    
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      e.preventDefault();
      targetElement.scrollIntoView({
        behavior: 'smooth'
      });
    }
  });
});
