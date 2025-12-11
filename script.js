/* jshint esversion: 6 */
/* jshint browser: true */

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function () {
    initYear();
    initSmoothNav();
    initSectionObserver();
    initAOSLike();
    initLazyIframe();
    initCookiesBanner();
    initContactForm();
    initParallax();
    initScrollReveal();
    initTypingEffect();
    initVideoModal();
    initImageDetection();
});

// NUEVO: Detectar si las imágenes cargan correctamente
function initImageDetection() {
    const sections = ['nosotros', 'servicios'];
    
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        const img = new Image();
        
        img.onload = function() {
            section.classList.remove('no-image');
        };
        
        img.onerror = function() {
            console.log(`❌ Imagen ${sectionId}.jpg no encontrada, usando fallback`);
            section.classList.add('no-image');
        };
        
        img.src = `img/${sectionId}.jpg`;
    });
}

// Actualizar año actual
function initYear() {
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

// Navegación suave mejorada
function initSmoothNav() {
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                const offsetTop = targetSection.offsetTop - document.querySelector('#mainNav').offsetHeight - 20;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
                
                const navbarCollapse = document.querySelector('.navbar-collapse');
                if (navbarCollapse.classList.contains('show')) {
                    const navbarToggler = document.querySelector('.navbar-toggler');
                    navbarToggler.click();
                }
                
                document.body.style.overflow = 'hidden';
                setTimeout(() => {
                    document.body.style.overflow = '';
                }, 1000);
            }
        });
    });
}

// Observer para cambiar color de navbar y marcar sección activa mejorado
function initSectionObserver() {
    const sections = document.querySelectorAll('section[id]');
    const navbarHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navbar-height'));
    
    const options = {
        root: null,
        rootMargin: `-${navbarHeight + 8}px 0px -60% 0px`,
        threshold: Array.from({length: 21}, (_, i) => i / 20)
    };
    
    const observer = new IntersectionObserver((entries) => {
        let maxRatio = 0;
        let activeSection = null;
        
        entries.forEach(entry => {
            if (entry.intersectionRatio > maxRatio) {
                maxRatio = entry.intersectionRatio;
                activeSection = entry.target;
            }
        });
        
        if (activeSection) {
            document.body.className = `navbar-${activeSection.id}`;
            
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${activeSection.id}`) {
                    link.classList.add('active');
                }
            });
        }
    }, options);
    
    sections.forEach(section => {
        observer.observe(section);
    });
}

// Animaciones al hacer scroll (AOS-like) mejorado
function initAOSLike() {
    const animatedElements = document.querySelectorAll('.animate-fade-in, .animate-slide-in-left, .animate-slide-in-right');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    animatedElements.forEach(element => {
        observer.observe(element);
    });
}

// Lazy loading para iframes (YouTube) mejorado
function initLazyIframe() {
    const lazyIframes = document.querySelectorAll('.lazy-iframe');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const iframe = entry.target;
                const src = iframe.getAttribute('data-src');
                if (src) {
                    iframe.setAttribute('src', src);
                    iframe.classList.add('fade-in');
                    observer.unobserve(iframe);
                }
            }
        });
    });
    
    lazyIframes.forEach(iframe => {
        observer.observe(iframe);
    });
}

// Banner de cookies - VERSIÓN SIMPLE
function initCookiesBanner() {
    const cookiesBanner = document.getElementById('cookiesBanner');
    const acceptButton = document.getElementById('acceptCookies');
    
    if (!localStorage.getItem('cookiesAccepted_v2')) {
        setTimeout(() => {
            cookiesBanner.style.display = 'block';
            cookiesBanner.classList.add('show');
        }, 2000);
    } else {
        cookiesBanner.style.display = 'none';
    }
    
    acceptButton.addEventListener('click', function() {
        localStorage.setItem('cookiesAccepted_v2', 'true');
        cookiesBanner.classList.remove('show');
        cookiesBanner.classList.add('hide');
        
        setTimeout(() => {
            cookiesBanner.style.display = 'none';
        }, 500);
    });
}

// Formulario de contacto con Formspree mejorado
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    const formMessage = document.getElementById('formMessage');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Enviando...';
            submitButton.disabled = true;
            contactForm.classList.add('loading');
            
            try {
                const formData = new FormData(contactForm);
                const response = await fetch(contactForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    formMessage.innerHTML = `
                        <div class="alert alert-success">
                            <i class="fas fa-check-circle me-2"></i>
                            ¡Mensaje enviado con éxito! Nos pondremos en contacto pronto.
                        </div>
                    `;
                    contactForm.reset();
                    createConfetti();
                } else {
                    throw new Error('Error al enviar el formulario');
                }
            } catch (error) {
                formMessage.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        Hubo un error al enviar el mensaje. Por favor, inténtalo de nuevo.
                    </div>
                `;
            } finally {
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
                contactForm.classList.remove('loading');
                
                setTimeout(() => {
                    formMessage.innerHTML = '';
                }, 5000);
            }
        });
    }
}

// Modal de Video
// Modal de Video - VERSIÓN CORREGIDA PARA ERROR 153
function initVideoModal() {
    const videoModal = document.getElementById('videoModal');
    const videoFrame = document.getElementById('videoFrame');
    
    // URL SIN parámetros problemáticos
    const videoUrl = 'https://www.youtube.com/embed/jy5hovMVlX4';
    
    if (videoModal && videoFrame) {
        // Prevenir que el modal cierre al hacer clic
        videoModal.addEventListener('click', function(e) {
            if (e.target === videoModal) {
                e.preventDefault();
                return false;
            }
        });
        
        // Cuando se abre el modal
        videoModal.addEventListener('show.bs.modal', function () {
            console.log('🎥 Abriendo modal...');
            videoFrame.src = videoUrl;
        });
        
        // Cuando se cierra el modal
        videoModal.addEventListener('hide.bs.modal', function () {
            console.log('🎥 Cerrando modal...');
            videoFrame.src = '';
        });
        
        // Prevenir clic en el iframe
        videoFrame.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            return false;
        });
    }
}

// Efecto parallax mejorado
function initParallax() {
    const parallaxElements = document.querySelectorAll('.section-bg');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        parallaxElements.forEach(element => {
            const speed = 0.5;
            const yPos = -(scrolled * speed);
            element.style.backgroundPosition = `center ${yPos}px`;
        });
    });
}

// Scroll reveal mejorado
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, {
        threshold: 0.1
    });
    
    reveals.forEach(element => {
        observer.observe(element);
    });
}

// Efecto de escritura para títulos
function initTypingEffect() {
    const titles = document.querySelectorAll('.typing-effect');
    
    titles.forEach(title => {
        const text = title.textContent;
        title.textContent = '';
        let index = 0;
        
        const type = () => {
            if (index < text.length) {
                title.textContent += text.charAt(index);
                index++;
                setTimeout(type, 50);
            }
        };
        
        setTimeout(type, 1000);
    });
}

// Crear efecto de confeti
function createConfetti() {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-10px';
        confetti.style.opacity = Math.random() + 0.5;
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        confetti.style.transition = `all ${2 + Math.random() * 2}s ease-out`;
        confetti.style.zIndex = '9999';
        
        document.body.appendChild(confetti);
        
        setTimeout(() => {
            confetti.style.top = '100%';
            confetti.style.transform = `rotate(${Math.random() * 720}deg)`;
            confetti.style.opacity = '0';
        }, 100);
        
        setTimeout(() => {
            confetti.remove();
        }, 4000);
    }
}

// Animación de entrada para el título principal mejorada
window.addEventListener('load', function() {
    const mainTitle = document.querySelector('.hero-content');
    if (mainTitle) {
        mainTitle.style.opacity = '0';
        mainTitle.style.transform = 'scale(0.8) translateY(50px)';
        
        setTimeout(() => {
            mainTitle.style.transition = 'all 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            mainTitle.style.opacity = '1';
            mainTitle.style.transform = 'scale(1) translateY(0)';
        }, 300);
    }
});

// Animación de partículas de fondo
function createParticles() {
    const particlesContainer = document.createElement('div');
    particlesContainer.style.position = 'fixed';
    particlesContainer.style.top = '0';
    particlesContainer.style.left = '0';
    particlesContainer.style.width = '100%';
    particlesContainer.style.height = '100%';
    particlesContainer.style.pointerEvents = 'none';
    particlesContainer.style.zIndex = '0';
    particlesContainer.style.overflow = 'hidden';
    
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = Math.random() * 5 + 'px';
        particle.style.height = particle.style.width;
        particle.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animation = `float ${5 + Math.random() * 10}s infinite ease-in-out`;
        particle.style.animationDelay = Math.random() * 5 + 's';
        
        particlesContainer.appendChild(particle);
    }
    
    document.body.insertBefore(particlesContainer, document.body.firstChild);
}

createParticles();

// Agregar animación ripple al CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    @keyframes slideInUp {
        from {
            transform: translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    @keyframes slideOutDown {
        from {
            transform: translateY(0);
            opacity: 1;
        }
        to {
            transform: translateY(100%);
            opacity: 0;
        }
    }
    .fade-in {
        animation: fadeIn 0.5s ease-out;
    }
`;
document.head.appendChild(style);