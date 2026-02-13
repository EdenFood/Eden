// State variables
let cart = JSON.parse(localStorage.getItem('edenCart')) || [];
let favorites = JSON.parse(localStorage.getItem('edenFavorites')) || [];
let reviews = {};
let currentDish = null;
let currentCategory = 'all';
let currentDietFilter = 'all';
let currentUser = JSON.parse(localStorage.getItem('edenUser')) || null;
let currentTheme = localStorage.getItem('edenTheme') || 'light';

// -------- Auth functions --------
async function signInWithGoogle() {
  try {
    if (!window.firebaseAuth || !window.firebaseSignInWithPopup || !window.googleProvider) {
      showNotification('Firebase not initialized. Check configuration.');
      return;
    }

    const result = await window.firebaseSignInWithPopup(window.firebaseAuth, window.googleProvider);
    const user = result.user;
    
    const firebaseUser = {
      uid: user.uid,
      name: user.displayName || 'User',
      email: user.email,
      picture: user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User') + '&background=a8e6cf&color=2e2e2e&size=128'
    };
    
    setCurrentUser(firebaseUser);
    
    const savedName = localStorage.getItem('edenUserName');
    if (!savedName && user.displayName) {
      localStorage.setItem('edenUserName', user.displayName);
    }
    
    if (savedName || user.displayName) {
      showNotification(`Welcome, ${savedName || user.displayName}!`);
    } else {
      showNameModal();
    }
  } catch (error) {
    console.error('Login error:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      showNotification('Login cancelled');
    } else {
      showNotification('Login error: ' + error.message);
    }
  }
}

function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem('edenUser', JSON.stringify(user));
  updateAuthUI();
}

function signOut() {
  if (window.firebaseAuth && window.firebaseSignOut) {
    window.firebaseSignOut(window.firebaseAuth).then(() => {
      currentUser = null;
      localStorage.removeItem('edenUser');
      updateAuthUI();
      showNotification('You have logged out');
    }).catch((error) => {
      console.error('Logout error:', error);
      currentUser = null;
      localStorage.removeItem('edenUser');
      updateAuthUI();
      showNotification('You have logged out');
    });
  } else {
    currentUser = null;
    localStorage.removeItem('edenUser');
    updateAuthUI();
    showNotification('You have logged out');
  }
}

function updateAuthUI() {
  const userPanel = document.getElementById('user-panel');
  const userNameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  const googleSigninBtn = document.getElementById('google-signin-btn');

  if (!userPanel || !googleSigninBtn) return;

  if (currentUser) {
    userPanel.classList.remove('hidden');
    googleSigninBtn.classList.add('hidden');
    const savedName = localStorage.getItem('edenUserName') || currentUser.name || 'User';
    userNameEl.textContent = savedName;
    if (currentUser.picture) {
      avatarEl.src = currentUser.picture;
      avatarEl.classList.remove('hidden');
    } else {
      avatarEl.src = '';
      avatarEl.classList.add('hidden');
    }
  } else {
    userPanel.classList.add('hidden');
    googleSigninBtn.classList.remove('hidden');
  }
}

// Name modal functions
function showNameModal() {
  const modal = document.getElementById('name-modal');
  const input = document.getElementById('user-name-input');
  if (modal && input) {
    modal.classList.remove('hidden');
    input.value = '';
    input.focus();
    
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        saveUserName();
      }
    });
  }
}

function closeNameModal() {
  const modal = document.getElementById('name-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function saveUserName() {
  const input = document.getElementById('user-name-input');
  const name = input ? input.value.trim() : '';
  
  if (name) {
    localStorage.setItem('edenUserName', name);
    if (currentUser) {
      currentUser.name = name;
      localStorage.setItem('edenUser', JSON.stringify(currentUser));
    }
    updateAuthUI();
    showNotification(`Name saved: ${name}`);
  } else {
    showNotification('Name not entered');
  }
  
  closeNameModal();
}

function skipNameInput() {
  closeNameModal();
  showNotification('Sign in successful. You can enter your name later.');
}

// -------- Theme functions --------
function applyTheme() {
  const body = document.body;
  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');

  if (!icon || !label) return;

  if (currentTheme === 'dark') {
    body.classList.add('dark');
    icon.textContent = '🌙';
    label.textContent = 'Dark theme';
  } else {
    body.classList.remove('dark');
    icon.textContent = '🌞';
    label.textContent = 'Light theme';
  }
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('edenTheme', currentTheme);
  applyTheme();
}

// Save functions
function saveCart() {
  localStorage.setItem('edenCart', JSON.stringify(cart));
}

function saveFavorites() {
  localStorage.setItem('edenFavorites', JSON.stringify(favorites));
}

function saveReviews() {
  localStorage.setItem('edenReviews', JSON.stringify(reviews));
}

// Animation function
function animateMenuChange(newContentFunction) {
  const menuElement = document.getElementById('menu');
  menuElement.classList.add('fade-out');
  
  setTimeout(() => {
    newContentFunction();
    menuElement.classList.remove('fade-out');
    
    const cards = document.querySelectorAll('.dish-card');
    cards.forEach((card, i) => {
      card.style.animationDelay = `${i * 0.05}s`;
      card.style.animation = 'cardAppear 0.4s ease forwards';
    });
  }, 300);
}

// Rating functions
function getAverageRating(dishId) {
  if (!reviews[dishId] || reviews[dishId].length === 0) return 0;
  
  const total = reviews[dishId].reduce((sum, review) => sum + review.rating, 0);
  return (total / reviews[dishId].length).toFixed(1);
}

function renderStars(rating) {
  let stars = '';
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars += '<i class="fas fa-star"></i>';
    } else if (i === fullStars && hasHalfStar) {
      stars += '<i class="fas fa-star-half-alt"></i>';
    } else {
      stars += '<i class="far fa-star"></i>';
    }
  }
  return stars;
}

// Render menu
function renderMenu(list = menu) {
  const container = document.getElementById('menu');
  container.innerHTML = '';
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-cart"><p>Dishes not found. Try changing your search query.</p></div>';
    return;
  }
  
  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'dish-card';
    
    let tag = '';
    if (item.cat === 'healthy') tag = '🥗 Healthy';
    else if (item.cat === 'spicy') tag = '🌶 Spicy';
    else if (item.cat === 'vegan') tag = '🌱 Vegan';
    else if (Array.isArray(item.cat) && item.cat.includes('vegan')) tag = '🌱 Vegan';
    
    const isFavorite = favorites.includes(item.id);
    const avgRating = getAverageRating(item.id);
    
    card.innerHTML = `
      ${tag ? `<div class="dish-tag">${tag}</div>` : ''}
      <img src="${item.img}" alt="${item.name}">
      <div class="dish-info">
        <h3>${item.name}</h3>
        <p>${item.desc}</p>
        ${avgRating > 0 ? `
          <div class="dish-rating">
            <span class="stars">${renderStars(avgRating)}</span>
            <span>${avgRating}</span>
          </div>
        ` : ''}
          <div class="dish-footer">
          <div class="dish-price">${item.price} $</div>
          <div class="dish-kcal"><i class="fas fa-fire"></i> ${item.kcal} kcal</div>
        </div>
      </div>
      <button class="quick-add" onclick="addToCart(${item.id})">
        <i class="fas fa-plus"></i>
      </button>
    `;
    
    card.onclick = (e) => {
      if (!e.target.closest('.quick-add')) {
        showModal(item);
      }
    };
    container.appendChild(card);
  });
  
  updateMenuTitle();
}

function updateMenuTitle() {
  const title = document.getElementById('menu-title');
  if (currentCategory === 'all' && currentDietFilter === 'all') {
    title.innerHTML = '<i class="fas fa-fire"></i> Popular dishes';
  } else {
    const categoryNames = {
      'healthy': '🥗 Healthy',
      'spicy': '🌶 Spicy',
      'sushi': '🍣 Sushi',
      'pasta': '🍝 Pasta',
      'vegan': '🌱 Vegan',
      'dessert': '🍰 Desserts',
      'breakfast': '🍳 Breakfast'
    };
    
    const dietFilterNames = {
      'all': '',
      'low-cal': '🍃 Low calorie',
      'vegetarian': '🥬 Vegetarian',
      'high-protein': '💪 High protein'
    };
    
    let titleText = '';
    if (currentCategory !== 'all') {
      titleText = categoryNames[currentCategory] || currentCategory;
    }
    if (currentDietFilter !== 'all') {
      if (titleText) titleText += ' • ';
      titleText += dietFilterNames[currentDietFilter];
    }
    
    title.innerHTML = `<i class="fas fa-${getCategoryIcon(currentCategory)}"></i> ${titleText || 'All'}`;
  }
}

function getCategoryIcon(cat) {
  const icons = {
    'healthy': 'heart',
    'spicy': 'pepper-hot',
    'sushi': 'fish',
    'pasta': 'utensils',
    'vegan': 'leaf',
    'dessert': 'ice-cream',
    'breakfast': 'egg'
  };
  return icons[cat] || 'utensils';
}

// Filter functions
function filterCat(cat) {
  currentCategory = cat;
  
  document.querySelectorAll('.category').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  animateMenuChange(() => {
    applyFilters();
  });
}

function setupDietFilters() {
  document.querySelectorAll('.diet-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.diet-filter').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      currentDietFilter = e.target.dataset.filter;
      
      animateMenuChange(() => {
        applyFilters();
      });
    });
  });
}

function applyFilters() {
  let filtered = menu;
  
  if (currentCategory !== 'all') {
    filtered = filtered.filter(i => 
      i.cat === currentCategory || (Array.isArray(i.cat) && i.cat.includes(currentCategory))
    );
  }
  
  if (currentDietFilter !== 'all') {
    switch (currentDietFilter) {
      case 'low-cal':
        filtered = filtered.filter(i => i.kcal < 300);
        break;
      case 'vegetarian':
        filtered = filtered.filter(i => i.vegetarian);
        break;
      case 'high-protein':
        filtered = filtered.filter(i => i.protein > 20);
        break;
    }
  }
  
  renderMenu(filtered);
}

// Search suggestions functions
function getPopularDishes() {
  return menu.slice(0, 6);
}

function renderPopularSuggestions() {
  const popularList = document.getElementById('popular-list');
  if (!popularList) return;
  
  const popular = getPopularDishes();
  let html = '';
  popular.forEach(item => {
    html += `
      <div class="suggestion-item" onclick="selectSuggestion('${item.name}')">
        <img src="${item.img}" alt="${item.name}">
        <div class="suggestion-item-info">
          <div class="suggestion-item-name">${item.name}</div>
          <div class="suggestion-item-price">${item.price} $</div>
        </div>
      </div>
    `;
  });
  popularList.innerHTML = html;
}

function renderRecentSearches() {
  const recentList = document.getElementById('recent-searches-list');
  const recentSection = document.getElementById('recent-searches-section');
  if (!recentList || !recentSection) return;
  
  const recent = JSON.parse(localStorage.getItem('edenRecentSearches')) || [];
  
  if (recent.length === 0) {
    recentSection.classList.add('hidden');
    return;
  }
  
  recentSection.classList.remove('hidden');
  let html = '';
  recent.slice(0, 5).forEach(term => {
    html += `
      <div class="suggestion-item-recent" onclick="selectSuggestion('${term}')">
        <i class="fas fa-clock"></i>
        <span>${term}</span>
      </div>
    `;
  });
  recentList.innerHTML = html;
}

function addToRecentSearches(term) {
  if (!term || term.trim() === '') return;
  
  let recent = JSON.parse(localStorage.getItem('edenRecentSearches')) || [];
  term = term.trim();
  
  recent = recent.filter(t => t.toLowerCase() !== term.toLowerCase());
  recent.unshift(term);
  recent = recent.slice(0, 10);
  
  localStorage.setItem('edenRecentSearches', JSON.stringify(recent));
}

function clearRecentSearches() {
  event.stopPropagation();
  localStorage.removeItem('edenRecentSearches');
  renderRecentSearches();
}

function selectSuggestion(term) {
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.value = term;
    searchInput.dispatchEvent(new Event('input'));
  }
  hideSuggestions();
}

function showSuggestions() {
  const suggestions = document.getElementById('search-suggestions');
  const popularSection = document.getElementById('popular-suggestions');
  if (suggestions) {
    suggestions.style.display = 'block';
    const popularTitle = popularSection ? popularSection.querySelector('.suggestions-title') : null;
    if (popularTitle) {
      popularTitle.textContent = 'Popular dishes';
    }
    renderPopularSuggestions();
    renderRecentSearches();
  }
}

function hideSuggestions() {
  const suggestions = document.getElementById('search-suggestions');
  if (suggestions) {
    suggestions.style.display = 'none';
  }
}

function renderSearchSuggestions(query) {
  const suggestions = document.getElementById('search-suggestions');
  const popularSection = document.getElementById('popular-suggestions');
  const recentSection = document.getElementById('recent-searches-section');
  
  if (!suggestions) return;
  
  if (!query || query.trim() === '') {
    const popularTitle = popularSection.querySelector('.suggestions-title');
    if (popularTitle) {
      popularTitle.textContent = 'Popular dishes';
    }
    showSuggestions();
    return;
  }
  
  const matches = menu.filter(i => 
    i.name.toLowerCase().includes(query.toLowerCase()) || 
    i.desc.toLowerCase().includes(query.toLowerCase()) ||
    i.ingr.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);
  
  if (matches.length > 0) {
    const popularList = document.getElementById('popular-list');
    if (popularList) {
      let html = '';
      matches.forEach(item => {
        html += `
          <div class="suggestion-item" onclick="selectSuggestion('${item.name}')">
            <img src="${item.img}" alt="${item.name}">
            <div class="suggestion-item-info">
              <div class="suggestion-item-name">${item.name}</div>
              <div class="suggestion-item-price">${item.price} $</div>
            </div>
          </div>
        `;
      });
      popularList.innerHTML = html;
      const popularTitle = popularSection.querySelector('.suggestions-title');
      if (popularTitle) {
        popularTitle.textContent = 'Search results';
      }
    }
    recentSection.classList.add('hidden');
    suggestions.style.display = 'block';
  } else {
    suggestions.style.display = 'none';
  }
}

// Cart functions
function addToCart(id) {
  event.stopPropagation();
  const item = menu.find(i => i.id === id);
  if (!item) return;
  
  const existingIndex = cart.findIndex(i => i.id === id);
  
  if (existingIndex !== -1) {
    if (!cart[existingIndex].quantity) cart[existingIndex].quantity = 1;
    cart[existingIndex].quantity++;
  } else {
    cart.push({...item, quantity: 1});
  }
  
  saveCart();
  updateCart();
  
  const button = event.target.closest('.quick-add');
  if (button) {
    button.innerHTML = '<i class="fas fa-check"></i>';
    button.style.background = '#4CAF50';
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-plus"></i>';
      button.style.background = 'var(--accent)';
    }, 1000);
  }
  
  showNotification(`${item.name} added to cart!`);
}

function toggleCart() {
  document.getElementById('cart').classList.toggle('open');
}

function updateCart() {
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  const cartBadge = document.getElementById('cart-badge');
  
  if (cart.length === 0) {
    cartItems.innerHTML = '<div class="empty-cart"><p>Cart is empty</p><p>Add dishes from menu</p></div>';
    cartTotal.textContent = '0 $';
    cartBadge.textContent = '0';
    return;
  }
  
  let itemsHTML = '';
  let total = 0;
  let totalItems = 0;
  
  cart.forEach((item, index) => {
    const itemTotal = item.price * (item.quantity || 1);
    total += itemTotal;
    totalItems += (item.quantity || 1);
    
    itemsHTML += `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <p>${item.price} $ × ${item.quantity || 1}</p>
        </div>
        <div class="cart-item-controls">
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="updateQuantity(${index}, -1)">-</button>
            <span>${item.quantity || 1}</span>
            <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
          </div>
          <button class="remove-item" onclick="removeItem(${index})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  });
  
  cartItems.innerHTML = itemsHTML;
  cartTotal.textContent = `${total} $`;
  cartBadge.textContent = totalItems;
}

function updateQuantity(index, change) {
  if (!cart[index].quantity) cart[index].quantity = 1;
  
  cart[index].quantity += change;
  
  if (cart[index].quantity < 1) {
    cart.splice(index, 1);
  }
  
  saveCart();
  updateCart();
}

function removeItem(index) {
  cart.splice(index, 1);
  saveCart();
  updateCart();
  showNotification('Dish removed from cart');
}

// Modal functions
function showModal(item) {
  currentDish = item;
  document.getElementById('modal-img').src = item.img;
  document.getElementById('modal-name').textContent = item.name;
  document.getElementById('modal-desc').textContent = item.desc;
  document.getElementById('modal-kcal').textContent = item.kcal + ' kcal';
  document.getElementById('modal-weight').textContent = item.weight;
  document.getElementById('modal-time').textContent = item.time;
  
  document.getElementById('modal-kcal-label').textContent = 'Calories';
  document.getElementById('modal-weight-label').textContent = 'Weight';
  document.getElementById('modal-time-label').textContent = 'Time';
  document.getElementById('modal-difficulty-label').textContent = 'Difficulty';
  document.getElementById('modal-ingr-label').textContent = 'Ingredients';
  
  let difficulty = item.difficulty;
  if (difficulty === 'Легко' || difficulty === 'Easy') difficulty = 'Easy';
  else if (difficulty === 'Средне' || difficulty === 'Medium') difficulty = 'Medium';
  else if (difficulty === 'Сложно' || difficulty === 'Hard') difficulty = 'Hard';
  document.getElementById('modal-difficulty').textContent = difficulty;
  document.getElementById('modal-ingr').textContent = item.ingr;
  
  document.getElementById('reviews-title').innerHTML = 'Reviews (<span id="reviews-count">0</span>)';
  document.getElementById('add-review-text').textContent = 'Add review';
  document.getElementById('clear-reviews-btn').textContent = 'Clear all reviews for this dish';
  document.getElementById('leave-review-title').textContent = 'Leave a review';
  document.getElementById('review-text').placeholder = 'Share your opinion about the dish...';
  document.getElementById('submit-review-btn').textContent = 'Submit review';
  document.getElementById('modal-add-text').textContent = 'Add';
  
  const favIcon = document.getElementById('modal-favorite-icon');
  if (favorites.includes(item.id)) {
    favIcon.style.color = '#ff6b6b';
  } else {
    favIcon.style.color = 'white';
  }
  
  loadReviews(item.id);
  
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function addFromModal() {
  if (currentDish) {
    addToCart(currentDish.id);
    closeModal();
  }
}

// Review functions
async function loadReviews(dishId) {
  const reviewsList = document.getElementById('reviews-list');
  const reviewsCount = document.getElementById('reviews-count');
  
  if (!reviewsList || !reviewsCount) return;

  reviewsList.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading reviews...</p></div>';
  reviewsCount.textContent = '0';

  if ((!reviews[dishId] || reviews[dishId].length === 0) && window.firebaseDb) {
    try {
      const colRef = window.firebaseCollection
        ? window.firebaseCollection(window.firebaseDb, 'reviews')
        : window.firebaseDb.collection('reviews');

      const queryRef = (window.firebaseQuery && window.firebaseWhere && window.firebaseOrderBy)
        ? window.firebaseQuery(
            colRef,
            window.firebaseWhere('dishId', '==', dishId),
            window.firebaseOrderBy('createdAt', 'desc')
          )
        : colRef.where('dishId', '==', dishId).orderBy('createdAt', 'desc');

      const snap = await (window.firebaseGetDocs
        ? window.firebaseGetDocs(queryRef)
        : queryRef.get());

      const dishReviews = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!data) return;

        let isoDate;
        const createdAt = data.createdAt;
        if (createdAt && typeof createdAt.toDate === 'function') {
          isoDate = createdAt.toDate().toISOString();
        } else if (typeof createdAt === 'string') {
          isoDate = createdAt;
        } else {
          isoDate = new Date().toISOString();
        }

        dishReviews.push({
          id: doc.id,
          author: data.author || 'Anonymous user',
          rating: Number(data.rating) || 0,
          text: data.text || '',
          date: isoDate
        });
      });

      reviews[dishId] = dishReviews;
      saveReviews();
    } catch (err) {
      console.error('Error loading dish reviews from Firestore:', err);
    }
  }

  if (!reviews[dishId] || reviews[dishId].length === 0) {
    reviewsList.innerHTML = '<div class="no-reviews"><p>No reviews yet. Be the first!</p></div>';
    reviewsCount.textContent = '0';
    return;
  }
  
  let reviewsHTML = '';
  reviews[dishId].forEach((review, index) => {
    const date = new Date(review.date).toLocaleDateString('en-US');
    reviewsHTML += `
      <div class="review-item">
        <div class="review-header">
          <div>
            <div class="review-author">${review.author}</div>
            <div class="review-date">${date}</div>
          </div>
          <button class="review-delete-btn" onclick="deleteReview(${dishId}, ${index})" title="Delete review">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="review-rating">${renderStars(review.rating)}</div>
        <div class="review-text">${review.text}</div>
      </div>
    `;
  });
  
  reviewsList.innerHTML = reviewsHTML;
  reviewsCount.textContent = reviews[dishId].length;
}

async function deleteReview(dishId, index) {
  if (!reviews[dishId]) return;

  const review = reviews[dishId][index];
  if (review && review.id) {
    await deleteReviewFromDb(review.id);
  }

  reviews[dishId].splice(index, 1);
  if (reviews[dishId].length === 0) {
    delete reviews[dishId];
  }
  saveReviews();
  await loadReviews(dishId);
  renderMenu();
  showNotification('Review deleted');
}

function showReviewForm() {
  document.getElementById('review-form').classList.remove('hidden');
}

async function submitReview() {
  const ratingInput = document.querySelector('input[name="rating"]:checked');
  const reviewTextEl = document.getElementById('review-text');
  const reviewText = reviewTextEl ? reviewTextEl.value.trim() : '';
  
  if (!ratingInput) {
    showNotification('Please select a rating');
    return;
  }
  
  if (!reviewText) {
    showNotification('Please write a review');
    return;
  }
  
  const rating = parseInt(ratingInput.value);
  const author = (currentUser && currentUser.name) || localStorage.getItem('edenUserName') || 'Anonymous user';
  const dishId = currentDish && currentDish.id;
  if (!dishId) {
    showNotification('Unknown dish');
    return;
  }

  const reviewObj = {
    author,
    rating,
    text: reviewText,
    date: new Date().toISOString()
  };

  try {
    const docId = await saveReviewToDb(dishId, reviewObj);

    if (!reviews[dishId]) {
      reviews[dishId] = [];
    }
    reviews[dishId].unshift({
      ...reviewObj,
      id: docId || (reviews[dishId][0] && reviews[dishId][0].id) || undefined
    });

    saveReviews();

    await loadReviews(dishId);
    renderMenu();

    document.getElementById('review-form').classList.add('hidden');
    
    document.querySelectorAll('input[name="rating"]').forEach(input => input.checked = false);
    if (reviewTextEl) {
      reviewTextEl.value = '';
    }
    
    showNotification('Thank you for your review!');
  } catch (err) {
    console.error('Error submitting review:', err);
    showNotification('Error saving review. Please try again.');
  }
}

async function clearReviewsCurrentDish() {
  if (!currentDish) {
    return;
  }
  if (!reviews[currentDish.id] || reviews[currentDish.id].length === 0) {
    showNotification('No reviews for this dish yet');
    return;
  }

  const dishId = currentDish.id;

  await clearReviewsForDishInDb(dishId);

  delete reviews[dishId];
  saveReviews();

  await loadReviews(dishId);
  renderMenu();
  showNotification('All reviews for this dish deleted');
}

// Favorites functions
function toggleFavorite(id) {
  event.stopPropagation();
  const index = favorites.indexOf(id);
  
  if (index === -1) {
    favorites.push(id);
    showNotification('Added to favorites ❤️');
  } else {
    favorites.splice(index, 1);
    showNotification('Removed from favorites');
  }
  
  saveFavorites();
  
  if (currentDish && currentDish.id === id) {
    const favIcon = document.getElementById('modal-favorite-icon');
    if (favorites.includes(id)) {
      favIcon.style.color = '#ff6b6b';
    } else {
      favIcon.style.color = 'white';
    }
  }
}

function showFavorites() {
  const modal = document.getElementById('favorites-modal');
  const list = document.getElementById('favorites-list');
  const modalTitle = modal.querySelector('h2');
  if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-heart" style="color: #ff6b6b;"></i> Favorites';
  
  if (favorites.length === 0) {
    list.innerHTML = '<div class="empty-cart"><p>No favorites yet</p></div>';
  } else {
    let html = '<div class="menu" style="grid-template-columns: 1fr; gap: 1rem;">';
    favorites.forEach(favId => {
      const item = menu.find(i => i.id === favId);
      if (item) {
        html += `
          <div class="dish-card" style="display: flex; align-items: center; gap: 1rem; cursor: default;">
            <img src="${item.img}" alt="${item.name}" style="width: 80px; height: 80px; border-radius: 12px;">
            <div style="flex: 1;">
              <h4 style="margin: 0 0 0.5rem;">${item.name}</h4>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="dish-price">${item.price} $</span>
                <div>
                  <button onclick="addToCart(${item.id})" style="background: var(--accent); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-cart-plus"></i>
                  </button>
                  <button onclick="toggleFavorite(${item.id})" style="background: #ffebee; color: #ff6b6b; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; margin-left: 0.5rem;">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    });
    html += '</div>';
    list.innerHTML = html;
  }
  
  modal.classList.remove('hidden');
}

function closeFavorites() {
  document.getElementById('favorites-modal').classList.add('hidden');
}

// Notification function
function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--mint);
    color: var(--text);
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: var(--shadow);
    z-index: 1001;
    animation: slideInRight 0.3s, fadeOut 0.3s 2.7s;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Scroll to top function
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Orders functions
function renderOrders() {
  const container = document.getElementById('orders-list');
  const headerCounter = document.getElementById('orders-count-header');
  const orders = JSON.parse(localStorage.getItem('edenOrders')) || [];

  if (headerCounter) {
    headerCounter.textContent = orders.length;
  }

  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = '<div class="empty-cart"><p>You haven\'t placed any orders yet.</p></div>';
    return;
  }

  const recent = orders.slice(-5).reverse();

  let html = '';
  recent.forEach(order => {
    const items = order.items.map(i => `${i.name} × ${i.quantity}`).join(', ');
    html += `
      <div style="padding: 0.9rem 0; border-bottom: 1px solid #f3f4f6;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap: 0.75rem;">
          <div>
            <div style="font-weight:600; font-size:0.95rem;">Order ${order.number}</div>
            <div style="font-size:0.8rem; color: var(--text-light); margin-top:0.1rem;">${order.date}</div>
            <div style="font-size:0.85rem; margin-top:0.35rem;">${items}</div>
          </div>
          <div style="text-align:right; white-space:nowrap;">
            <div style="font-weight:700;">${order.total} $</div>
            <div style="font-size:0.8rem; color: var(--text-light); margin-top:0.1rem;">${order.items.length} items</div>
          </div>
        </div>
        ${order.comment ? `<div style="font-size:0.8rem; color: var(--text-light); margin-top:0.45rem;">Comment: ${order.comment}</div>` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

function showOrders() {
  const modal = document.getElementById('orders-modal');
  if (modal) {
    const title = modal.querySelector('h2');
    if (title) title.innerHTML = '<i class="fas fa-receipt" style="color: var(--accent);"></i> Order history';
    const desc = modal.querySelector('p');
    if (desc) desc.textContent = 'Your recent orders on this device are saved here.';
    const clearBtn = modal.querySelector('button[onclick="clearOrders()"]');
    if (clearBtn) clearBtn.textContent = 'Clear history';
  }
  renderOrders();
  if (modal) modal.classList.remove('hidden');
}

function closeOrders() {
  const modal = document.getElementById('orders-modal');
  if (modal) modal.classList.add('hidden');
}

function clearOrders() {
  localStorage.removeItem('edenOrders');
  const headerCounter = document.getElementById('orders-count-header');
  if (headerCounter) {
    headerCounter.textContent = '0';
  }
  const container = document.getElementById('orders-list');
  if (container) {
    container.innerHTML = '<div class="empty-cart"><p>Order history cleared.</p></div>';
  }
  showNotification('Order history cleared');
}

// Checkout functions
function showCheckout() {
  if (cart.length === 0) {
    showNotification('Add dishes to cart before checkout');
    return;
  }
  const checkoutModal = document.getElementById('checkout');
  const title = checkoutModal.querySelector('h2');
  if (title) title.textContent = 'Checkout';
  const nameInput = document.getElementById('name');
  const phoneInput = document.getElementById('phone');
  const addressInput = document.getElementById('address');
  const commentInput = document.getElementById('comment');
  
  const savedName = localStorage.getItem('edenUserName');
  if (nameInput) {
    if (savedName) {
      nameInput.value = savedName;
      nameInput.placeholder = 'Your name';
    } else {
      nameInput.value = '';
      nameInput.placeholder = 'Your name';
    }
  }
  
  if (phoneInput) {
    phoneInput.placeholder = 'Phone';
    phoneInput.value = '';
    phoneInput.addEventListener('input', function(e) {
      this.value = this.value.replace(/[^0-9]/g, '');
    });
    phoneInput.addEventListener('paste', function(e) {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text');
      this.value = paste.replace(/[^0-9]/g, '');
    });
    phoneInput.addEventListener('keypress', function(e) {
      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }
  if (addressInput) addressInput.placeholder = 'Delivery address';
  if (commentInput) commentInput.placeholder = 'Order comment';
  const submitBtn = checkoutModal.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-check"></i> Confirm order';
  checkoutModal.classList.remove('hidden');
  toggleCart();
}

function closeCheckout() {
  document.getElementById('checkout').classList.add('hidden');
}

function submitOrder(e) {
  e.preventDefault();
  
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();
  const comment = document.getElementById('comment').value.trim();
  
  if (!name || !phone || !address) {
    showNotification('Please fill in required fields: name, phone and address');
    return;
  }
  
  localStorage.setItem('edenUserName', name);
  if (currentUser) {
    currentUser.name = name;
    localStorage.setItem('edenUser', JSON.stringify(currentUser));
    updateAuthUI();
  }
  
  const orderNumber = 'EDN-' + Date.now().toString().slice(-6);
  const order = {
    number: orderNumber,
    name,
    phone,
    address,
    comment,
    items: cart.map(item => ({
      name: item.name,
      quantity: item.quantity || 1,
      price: item.price
    })),
    total: cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0),
    date: new Date().toLocaleString('en-US')
  };
  
  const orders = JSON.parse(localStorage.getItem('edenOrders')) || [];
  orders.push(order);
  localStorage.setItem('edenOrders', JSON.stringify(orders));
  renderOrders();
  
  const successModal = document.getElementById('order-success');
  const orderNumberEl = document.getElementById('order-number');
  const orderSuccessMessage = document.getElementById('order-success-message');
  const continueBtn = successModal.querySelector('button');
  
  if (orderNumberEl) orderNumberEl.textContent = orderNumber;
  if (orderSuccessMessage) {
    orderSuccessMessage.textContent = `Thank you, ${name}! Your order #${orderNumber} has been accepted. We will call ${phone} to confirm.`;
  }
  if (successModal.querySelector('h2')) successModal.querySelector('h2').textContent = 'Order accepted!';
  if (continueBtn) continueBtn.textContent = 'Continue shopping';
  
  closeCheckout();
  successModal.classList.remove('hidden');
  
  cart = [];
  saveCart();
  updateCart();
  
  document.getElementById('name').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('address').value = '';
  document.getElementById('comment').value = '';
}

function closeOrderSuccess() {
  document.getElementById('order-success').classList.add('hidden');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderMenu();
  updateCart();
  setupDietFilters();
  
  reviews = {};
  syncReviewsFromDb();
  
  if (!localStorage.getItem('edenFavorites')) {
    localStorage.setItem('edenFavorites', JSON.stringify([]));
  }
  favorites = JSON.parse(localStorage.getItem('edenFavorites')) || [];
  
  currentUser = JSON.parse(localStorage.getItem('edenUser')) || null;
  updateAuthUI();
  
  if (window.firebaseAuth && window.onAuthStateChanged) {
    window.onAuthStateChanged(window.firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        const user = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || localStorage.getItem('edenUserName') || 'User',
          email: firebaseUser.email,
          picture: firebaseUser.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(firebaseUser.displayName || 'User') + '&background=a8e6cf&color=2e2e2e&size=128'
        };
        setCurrentUser(user);
        if (firebaseUser.displayName && !localStorage.getItem('edenUserName')) {
          localStorage.setItem('edenUserName', firebaseUser.displayName);
        }
      } else {
        currentUser = null;
        localStorage.removeItem('edenUser');
        updateAuthUI();
      }
    });
  }

  currentTheme = localStorage.getItem('edenTheme') || 'light';
  applyTheme();

  renderOrders();
  
  renderPopularSuggestions();
  renderRecentSearches();
  
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', function(e) {
      this.value = this.value.replace(/[^0-9]/g, '');
    });
    phoneInput.addEventListener('paste', function(e) {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text');
      this.value = paste.replace(/[^0-9]/g, '');
    });
    phoneInput.addEventListener('keypress', function(e) {
      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }
  
  setTimeout(() => {
    document.querySelectorAll('.dish-card').forEach((card, i) => {
      card.style.animationDelay = `${i * 0.05}s`;
      card.style.animation = 'cardAppear 0.5s ease forwards';
    });
  }, 100);

  // Search input event listeners
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      const val = e.target.value;
      const valLower = val.toLowerCase();
      
      renderSearchSuggestions(val);
      
      if (val === '') {
        animateMenuChange(() => applyFilters());
        return;
      }
      
      animateMenuChange(() => {
        const filtered = menu.filter(i => 
          i.name.toLowerCase().includes(valLower) || 
          i.desc.toLowerCase().includes(valLower) ||
          i.ingr.toLowerCase().includes(valLower)
        );
        renderMenu(filtered);
      });
    });
    
    searchInput.addEventListener('focus', () => {
      renderSearchSuggestions(searchInput.value);
    });
    
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = searchInput.value.trim();
        if (val) {
          addToRecentSearches(val);
          hideSuggestions();
        }
      }
    });
  }
  
  // Close suggestions on click outside
  document.addEventListener('click', (e) => {
    const searchContainer = document.querySelector('.search-container');
    const suggestions = document.getElementById('search-suggestions');
    if (searchContainer && suggestions && !searchContainer.contains(e.target)) {
      hideSuggestions();
    }
  });

  // Close modals on outside click
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModal();
      closeCheckout();
      closeFavorites();
      closeOrderSuccess();
      closeOrders();
    }
    if (e.target.classList.contains('name-modal')) {
      closeNameModal();
    }
  });

  // Scroll to top button
  window.addEventListener('scroll', () => {
    const btn = document.getElementById('scroll-top');
    if (!btn) return;
    if (window.scrollY > 300) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  });
});
