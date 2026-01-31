/**
 * Premium Solitaire Game
 * Supports: Klondike (Turn 1 & 3), Pyramid
 */

// ============================================
// CONSTANTS & UTILITIES
// ============================================

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RANK_VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };

const isRed = (suit) => suit === 'hearts' || suit === 'diamonds';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Touch/Mouse position helpers
const getEventPos = (e) => {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
};

// ============================================
// CARD CLASS
// ============================================

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.faceUp = false;
        this.element = null;
        this.id = `${rank}-${suit}`;
    }

    get value() {
        return RANK_VALUES[this.rank];
    }

    get color() {
        return isRed(this.suit) ? 'red' : 'black';
    }

    get symbol() {
        return SUIT_SYMBOLS[this.suit];
    }

    flip() {
        this.faceUp = !this.faceUp;
        if (this.element) {
            this.element.classList.add('flip');
            setTimeout(() => {
                this.render();
                this.element.classList.remove('flip');
            }, 150);
        }
    }

    createElement() {
        const el = document.createElement('div');
        el.className = 'card';
        el.dataset.cardId = this.id;
        this.element = el;
        this.render();
        return el;
    }

    render() {
        if (!this.element) return;

        if (this.faceUp) {
            this.element.className = `card face-up ${this.color}`;
            this.element.innerHTML = `
                <div class="card-corner top">
                    <span class="card-rank">${this.rank}</span>
                    <span class="card-suit">${this.symbol}</span>
                </div>
                <span class="card-center">${this.symbol}</span>
                <div class="card-corner bottom">
                    <span class="card-rank">${this.rank}</span>
                    <span class="card-suit">${this.symbol}</span>
                </div>
            `;
        } else {
            this.element.className = 'card face-down';
            this.element.innerHTML = '';
        }
    }
}

// ============================================
// DECK CLASS
// ============================================

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push(new Card(suit, rank));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        return this.cards.pop();
    }
}

// ============================================
// STATISTICS MANAGER
// ============================================

class Statistics {
    constructor() {
        this.data = this.load();
    }

    load() {
        const saved = localStorage.getItem('solitaire-stats');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            klondike1: { played: 0, won: 0 },
            klondike3: { played: 0, won: 0 },
            pyramid: { played: 0, won: 0 }
        };
    }

    save() {
        localStorage.setItem('solitaire-stats', JSON.stringify(this.data));
    }

    recordGame(gameType, won) {
        if (this.data[gameType]) {
            this.data[gameType].played++;
            if (won) {
                this.data[gameType].won++;
            }
            this.save();
        }
    }

    getStats(gameType) {
        const stats = this.data[gameType] || { played: 0, won: 0 };
        const rate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
        return { ...stats, rate };
    }

    reset() {
        this.data = {
            klondike1: { played: 0, won: 0 },
            klondike3: { played: 0, won: 0 },
            pyramid: { played: 0, won: 0 }
        };
        this.save();
    }
}

// ============================================
// KLONDIKE SOLITAIRE
// ============================================

class KlondikeGame {
    constructor(drawCount = 1) {
        this.drawCount = drawCount;
        this.gameType = drawCount === 1 ? 'klondike1' : 'klondike3';
        this.deck = new Deck();
        this.stock = [];
        this.waste = [];
        this.foundations = { hearts: [], diamonds: [], clubs: [], spades: [] };
        this.tableau = [[], [], [], [], [], [], []];
        this.moves = 0;
        this.selectedCard = null;
        this.selectedSource = null;
        this.gameStarted = false;
        this.gameEnded = false;

        // Drag state
        this.isDragging = false;
        this.dragCards = [];
        this.dragSource = null;
        this.dragStartPos = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.dragElements = [];

        this.stockEl = document.getElementById('stock');
        this.wasteEl = document.getElementById('waste');
        this.foundationsEl = document.getElementById('foundations');
        this.tableauEl = document.getElementById('tableau');
    }

    // Serialize game state for persistence
    serialize() {
        return {
            gameType: this.gameType,
            drawCount: this.drawCount,
            stock: this.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
            waste: this.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
            foundations: {
                hearts: this.foundations.hearts.map(c => ({ suit: c.suit, rank: c.rank })),
                diamonds: this.foundations.diamonds.map(c => ({ suit: c.suit, rank: c.rank })),
                clubs: this.foundations.clubs.map(c => ({ suit: c.suit, rank: c.rank })),
                spades: this.foundations.spades.map(c => ({ suit: c.suit, rank: c.rank }))
            },
            tableau: this.tableau.map(pile => pile.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
            moves: this.moves,
            gameStarted: this.gameStarted,
            gameEnded: this.gameEnded
        };
    }

    // Restore game from saved state
    async restore(state) {
        this.drawCount = state.drawCount;
        this.moves = state.moves;
        this.gameStarted = state.gameStarted;
        this.gameEnded = state.gameEnded;

        // Recreate cards
        this.stock = state.stock.map(s => {
            const card = new Card(s.suit, s.rank);
            card.faceUp = s.faceUp;
            return card;
        });

        this.waste = state.waste.map(s => {
            const card = new Card(s.suit, s.rank);
            card.faceUp = s.faceUp;
            return card;
        });

        this.foundations = {
            hearts: state.foundations.hearts.map(s => { const c = new Card(s.suit, s.rank); c.faceUp = true; return c; }),
            diamonds: state.foundations.diamonds.map(s => { const c = new Card(s.suit, s.rank); c.faceUp = true; return c; }),
            clubs: state.foundations.clubs.map(s => { const c = new Card(s.suit, s.rank); c.faceUp = true; return c; }),
            spades: state.foundations.spades.map(s => { const c = new Card(s.suit, s.rank); c.faceUp = true; return c; })
        };

        this.tableau = state.tableau.map(pile => pile.map(s => {
            const card = new Card(s.suit, s.rank);
            card.faceUp = s.faceUp;
            return card;
        }));

        this.clearBoard();
        this.renderAll();
        this.setupEventListeners();
        this.updateMoveCounter();
    }

    renderAll() {
        // Render stock
        this.renderStock();

        // Render waste
        this.renderWaste();

        // Render foundations
        for (const suit of SUITS) {
            this.renderFoundation(suit);
        }

        // Render tableau
        for (let i = 0; i < 7; i++) {
            this.renderTableauPile(i);
        }
    }

    saveState() {
        if (this.gameStarted && !this.gameEnded) {
            const state = this.serialize();
            localStorage.setItem('solitaire-current-game', JSON.stringify(state));
        }
    }

    clearSavedState() {
        localStorage.removeItem('solitaire-current-game');
    }

    async init() {
        this.deck.reset();
        this.deck.shuffle();
        this.stock = [];
        this.waste = [];
        this.foundations = { hearts: [], diamonds: [], clubs: [], spades: [] };
        this.tableau = [[], [], [], [], [], [], []];
        this.moves = 0;
        this.selectedCard = null;
        this.selectedSource = null;
        this.gameStarted = false;
        this.gameEnded = false;

        this.clearBoard();
        await this.deal();
        this.setupEventListeners();
        this.updateMoveCounter();
    }

    clearBoard() {
        this.stockEl.innerHTML = '';
        this.wasteEl.innerHTML = '';

        document.querySelectorAll('.foundation').forEach(el => {
            el.innerHTML = '';
        });

        document.querySelectorAll('.tableau-pile').forEach(el => {
            el.innerHTML = '';
        });
    }

    async deal() {
        // Deal to tableau
        for (let i = 0; i < 7; i++) {
            for (let j = i; j < 7; j++) {
                const card = this.deck.draw();
                if (j === i) {
                    card.faceUp = true;
                }
                this.tableau[j].push(card);

                const el = card.createElement();
                const pile = this.tableauEl.children[j];
                el.style.top = `calc(${this.tableau[j].length - 1} * var(--card-overlap-hidden))`;

                if (card.faceUp) {
                    el.style.top = `calc(${this.getVisibleOffset(j)} * var(--card-overlap))`;
                }

                pile.appendChild(el);

                el.classList.add('dealing');
                el.style.animationDelay = `${(i * 7 + (j - i)) * 30}ms`;
            }
        }

        // Rest goes to stock
        while (this.deck.cards.length > 0) {
            this.stock.push(this.deck.draw());
        }

        await delay(400);
        this.renderStock();
        this.gameStarted = true;
    }

    getVisibleOffset(pileIndex) {
        let offset = 0;
        for (let i = 0; i < this.tableau[pileIndex].length - 1; i++) {
            offset += this.tableau[pileIndex][i].faceUp ? 1 : 0.5;
        }
        return offset;
    }

    renderStock() {
        this.stockEl.innerHTML = '';
        this.stockEl.classList.toggle('empty', this.stock.length === 0);

        if (this.stock.length > 0) {
            // Show up to 3 stacked cards
            const showCount = Math.min(3, this.stock.length);
            for (let i = 0; i < showCount; i++) {
                const placeholder = document.createElement('div');
                placeholder.className = 'card face-down';
                placeholder.style.top = `${i * 2}px`;
                placeholder.style.left = `${i * 2}px`;
                this.stockEl.appendChild(placeholder);
            }
        }
    }

    renderWaste() {
        this.wasteEl.innerHTML = '';

        const visibleCount = Math.min(this.drawCount, this.waste.length);
        const startIndex = Math.max(0, this.waste.length - visibleCount);

        for (let i = startIndex; i < this.waste.length; i++) {
            const card = this.waste[i];
            card.faceUp = true;
            const el = card.createElement();
            el.style.left = `${(i - startIndex) * 15}px`;
            this.wasteEl.appendChild(el);
        }
    }

    renderFoundation(suit) {
        const foundationEl = this.foundationsEl.querySelector(`[data-suit="${suit}"]`);
        foundationEl.innerHTML = '';

        const cards = this.foundations[suit];
        if (cards.length > 0) {
            const topCard = cards[cards.length - 1];
            topCard.faceUp = true;
            foundationEl.appendChild(topCard.createElement());
        }
    }

    renderTableauPile(pileIndex) {
        const pile = this.tableau[pileIndex];
        const pileEl = this.tableauEl.children[pileIndex];
        pileEl.innerHTML = '';

        let offset = 0;
        pile.forEach((card, i) => {
            const el = card.createElement();
            el.style.top = `calc(${offset} * var(--card-overlap))`;
            offset += card.faceUp ? 1 : 0.5;
            pileEl.appendChild(el);
        });
    }

    setupEventListeners() {
        // Stock click
        this.stockEl.onclick = () => this.drawFromStock();

        // Card clicks (only cards with data-card-id, not stock placeholders)
        document.querySelectorAll('.card[data-card-id]').forEach(el => {
            el.onclick = (e) => this.handleCardClick(e);
        });

        // Foundation clicks
        document.querySelectorAll('.foundation').forEach(el => {
            el.onclick = (e) => this.handleFoundationClick(e);
        });

        // Tableau pile clicks (for empty piles)
        document.querySelectorAll('.tableau-pile').forEach(el => {
            el.onclick = (e) => this.handleTableauClick(e);
        });

        // Double-click to auto-move to foundation
        document.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

        // Drag and drop
        this.setupDragListeners();
    }

    setupDragListeners() {
        const gameArea = document.getElementById('klondike-board');

        // Remove old listeners by cloning (clean slate)
        const handleDragStart = (e) => this.onDragStart(e);
        const handleDragMove = (e) => this.onDragMove(e);
        const handleDragEnd = (e) => this.onDragEnd(e);

        gameArea.addEventListener('mousedown', handleDragStart, { passive: false });
        gameArea.addEventListener('touchstart', handleDragStart, { passive: false });

        document.addEventListener('mousemove', handleDragMove, { passive: false });
        document.addEventListener('touchmove', handleDragMove, { passive: false });

        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('touchend', handleDragEnd);
        document.addEventListener('touchcancel', handleDragEnd);
    }

    onDragStart(e) {
        if (this.gameEnded) return;

        const cardEl = e.target.closest('.card');
        if (!cardEl) return;

        const card = this.findCardByElement(cardEl);
        if (!card || !card.faceUp) return;

        const source = this.findCardSource(card);
        if (!source) return;

        // Can't drag from foundations
        if (source.type === 'foundation') return;

        // Get cards to drag
        let cardsToDrag = [card];
        if (source.type === 'tableau') {
            const pile = this.tableau[source.index];
            const startIndex = pile.indexOf(card);
            cardsToDrag = pile.slice(startIndex);
        }

        // Start drag
        e.preventDefault();
        this.clearSelection();

        const pos = getEventPos(e);
        const rect = cardEl.getBoundingClientRect();

        this.isDragging = true;
        this.dragCards = cardsToDrag;
        this.dragSource = source;
        this.dragStartPos = { x: rect.left, y: rect.top };
        this.dragOffset = { x: pos.x - rect.left, y: pos.y - rect.top };
        this.dragElements = [];

        // Create drag elements
        cardsToDrag.forEach((c, i) => {
            const el = c.element;
            const originalRect = el.getBoundingClientRect();

            el.classList.add('dragging');
            el.style.position = 'fixed';
            el.style.left = `${originalRect.left}px`;
            el.style.top = `${originalRect.top}px`;
            el.style.zIndex = 1000 + i;
            el.style.width = `${originalRect.width}px`;
            el.style.height = `${originalRect.height}px`;

            this.dragElements.push({
                el,
                startLeft: originalRect.left,
                startTop: originalRect.top
            });
        });
    }

    onDragMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();

        const pos = getEventPos(e);
        const deltaX = pos.x - this.dragOffset.x - this.dragStartPos.x;
        const deltaY = pos.y - this.dragOffset.y - this.dragStartPos.y;

        this.dragElements.forEach((item, i) => {
            item.el.style.left = `${item.startLeft + deltaX}px`;
            item.el.style.top = `${item.startTop + deltaY}px`;
        });
    }

    onDragEnd(e) {
        if (!this.isDragging) return;

        const pos = e.changedTouches ?
            { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } :
            { x: e.clientX, y: e.clientY };

        // Find drop target
        const dropTarget = this.findDropTarget(pos.x, pos.y);

        // Reset drag elements first
        this.dragElements.forEach(item => {
            item.el.classList.remove('dragging');
            item.el.style.position = '';
            item.el.style.left = '';
            item.el.style.top = '';
            item.el.style.zIndex = '';
            item.el.style.width = '';
            item.el.style.height = '';
        });

        if (dropTarget) {
            // Perform the move
            this.executeDragMove(dropTarget);
        } else {
            // Re-render source to reset positions
            if (this.dragSource.type === 'tableau') {
                this.renderTableauPile(this.dragSource.index);
            } else if (this.dragSource.type === 'waste') {
                this.renderWaste();
            }
        }

        this.isDragging = false;
        this.dragCards = [];
        this.dragSource = null;
        this.dragElements = [];
        this.rebindEvents();
    }

    findDropTarget(x, y) {
        const card = this.dragCards[0];

        // Check foundations (only single cards)
        if (this.dragCards.length === 1) {
            const foundations = document.querySelectorAll('.foundation');
            for (const foundationEl of foundations) {
                const rect = foundationEl.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    const suit = foundationEl.dataset.suit;
                    if (this.canMoveToFoundation(card, suit)) {
                        return { type: 'foundation', suit };
                    }
                }
            }
        }

        // Check tableau piles
        const piles = document.querySelectorAll('.tableau-pile');
        for (const pileEl of piles) {
            const rect = pileEl.getBoundingClientRect();
            // Expand hit area vertically for piles
            if (x >= rect.left && x <= rect.right && y >= rect.top - 20 && y <= rect.bottom + 50) {
                const pileIndex = parseInt(pileEl.dataset.pile);
                if (pileIndex !== this.dragSource.index || this.dragSource.type !== 'tableau') {
                    if (this.canMoveToTableau(card, pileIndex)) {
                        return { type: 'tableau', index: pileIndex };
                    }
                }
            }
        }

        return null;
    }

    executeDragMove(target) {
        const card = this.dragCards[0];
        const source = this.dragSource;

        if (target.type === 'foundation') {
            // Remove from source
            if (source.type === 'waste') {
                this.waste.splice(this.waste.indexOf(card), 1);
            } else if (source.type === 'tableau') {
                this.tableau[source.index].pop();
                this.flipTopCard(source.index);
            }

            // Add to foundation
            this.foundations[target.suit].push(card);

            // Update UI
            this.renderFoundation(target.suit);
            if (source.type === 'waste') {
                this.renderWaste();
            } else if (source.type === 'tableau') {
                this.renderTableauPile(source.index);
            }

            this.moves++;
            this.updateMoveCounter();
            this.saveState();
            this.checkWin();

        } else if (target.type === 'tableau') {
            // Remove from source
            if (source.type === 'waste') {
                this.waste.pop();
            } else if (source.type === 'tableau') {
                const pile = this.tableau[source.index];
                const startIndex = pile.indexOf(card);
                this.tableau[source.index] = pile.slice(0, startIndex);
                this.flipTopCard(source.index);
            }

            // Add to target
            this.tableau[target.index].push(...this.dragCards);

            // Update UI
            if (source.type === 'waste') {
                this.renderWaste();
            } else if (source.type === 'tableau') {
                this.renderTableauPile(source.index);
            }
            this.renderTableauPile(target.index);

            this.moves++;
            this.updateMoveCounter();
            this.saveState();
        }
    }

    drawFromStock() {
        if (this.gameEnded) return;
        this.clearSelection();

        if (this.stock.length === 0) {
            // Reset stock from waste
            while (this.waste.length > 0) {
                const card = this.waste.pop();
                card.faceUp = false;
                this.stock.push(card);
            }
        } else {
            // Draw cards
            const count = Math.min(this.drawCount, this.stock.length);
            for (let i = 0; i < count; i++) {
                const card = this.stock.pop();
                card.faceUp = true;
                this.waste.push(card);
            }
            this.moves++;
            this.updateMoveCounter();
        }

        this.renderStock();
        this.renderWaste();
        this.rebindEvents();
        this.saveState();
    }

    handleCardClick(e) {
        if (this.gameEnded) return;
        e.stopPropagation();

        const cardEl = e.target.closest('.card');
        if (!cardEl) return;

        const card = this.findCardByElement(cardEl);
        if (!card || !card.faceUp) return;

        const source = this.findCardSource(card);

        if (this.selectedCard === card) {
            this.clearSelection();
            return;
        }

        if (this.selectedCard) {
            // Try to move selected card(s) to this location
            if (source.type === 'tableau') {
                this.tryMove(source.index);
            }
        } else {
            // Select this card
            this.selectCard(card, source);
        }
    }

    handleFoundationClick(e) {
        if (this.gameEnded) return;
        e.stopPropagation();

        if (!this.selectedCard) return;

        const foundationEl = e.target.closest('.foundation');
        const suit = foundationEl.dataset.suit;

        if (this.canMoveToFoundation(this.selectedCard, suit)) {
            this.moveToFoundation(suit);
        }
    }

    handleTableauClick(e) {
        if (this.gameEnded) return;
        e.stopPropagation();

        if (!this.selectedCard) return;

        const pileEl = e.target.closest('.tableau-pile');
        if (!pileEl) return;

        const pileIndex = parseInt(pileEl.dataset.pile);
        this.tryMove(pileIndex);
    }

    handleDoubleClick(e) {
        if (this.gameEnded) return;

        const cardEl = e.target.closest('.card');
        if (!cardEl) return;

        const card = this.findCardByElement(cardEl);
        if (!card || !card.faceUp) return;

        const source = this.findCardSource(card);

        // Only auto-move single cards
        if (source.type === 'tableau') {
            const pile = this.tableau[source.index];
            if (pile.indexOf(card) !== pile.length - 1) return;
        }

        // Try to move to foundation
        for (const suit of SUITS) {
            if (card.suit === suit && this.canMoveToFoundation(card, suit)) {
                this.selectCard(card, source);
                this.moveToFoundation(suit);
                return;
            }
        }
    }

    findCardByElement(el) {
        const cardId = el.dataset.cardId;

        // Check waste
        for (const card of this.waste) {
            if (card.id === cardId) return card;
        }

        // Check foundations
        for (const suit of SUITS) {
            for (const card of this.foundations[suit]) {
                if (card.id === cardId) return card;
            }
        }

        // Check tableau
        for (const pile of this.tableau) {
            for (const card of pile) {
                if (card.id === cardId) return card;
            }
        }

        return null;
    }

    findCardSource(card) {
        // Check waste
        if (this.waste.includes(card)) {
            return { type: 'waste', index: this.waste.indexOf(card) };
        }

        // Check foundations
        for (const suit of SUITS) {
            if (this.foundations[suit].includes(card)) {
                return { type: 'foundation', suit };
            }
        }

        // Check tableau
        for (let i = 0; i < 7; i++) {
            if (this.tableau[i].includes(card)) {
                return { type: 'tableau', index: i, cardIndex: this.tableau[i].indexOf(card) };
            }
        }

        return null;
    }

    selectCard(card, source) {
        this.clearSelection();
        this.selectedCard = card;
        this.selectedSource = source;
        card.element.classList.add('selected');

        // If selecting from tableau, also highlight cards below
        if (source.type === 'tableau') {
            const pile = this.tableau[source.index];
            const startIndex = pile.indexOf(card);
            for (let i = startIndex + 1; i < pile.length; i++) {
                pile[i].element.classList.add('selected');
            }
        }
    }

    clearSelection() {
        document.querySelectorAll('.card.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.selectedCard = null;
        this.selectedSource = null;
    }

    canMoveToFoundation(card, suit) {
        if (card.suit !== suit) return false;

        const foundation = this.foundations[suit];
        if (foundation.length === 0) {
            return card.rank === 'A';
        }

        const topCard = foundation[foundation.length - 1];
        return card.value === topCard.value + 1;
    }

    canMoveToTableau(card, pileIndex) {
        const pile = this.tableau[pileIndex];

        if (pile.length === 0) {
            return card.rank === 'K';
        }

        const topCard = pile[pile.length - 1];
        return topCard.faceUp &&
               card.color !== topCard.color &&
               card.value === topCard.value - 1;
    }

    moveToFoundation(suit) {
        if (!this.selectedCard) return;

        const card = this.selectedCard;
        const source = this.selectedSource;

        // Remove from source
        if (source.type === 'waste') {
            this.waste.splice(this.waste.indexOf(card), 1);
        } else if (source.type === 'tableau') {
            this.tableau[source.index].pop();
            this.flipTopCard(source.index);
        }

        // Add to foundation
        this.foundations[suit].push(card);

        // Update UI
        card.element.classList.add('move-to-foundation');
        setTimeout(() => {
            this.renderFoundation(suit);
            if (source.type === 'waste') {
                this.renderWaste();
            } else if (source.type === 'tableau') {
                this.renderTableauPile(source.index);
            }
            this.rebindEvents();
        }, 200);

        this.moves++;
        this.updateMoveCounter();
        this.clearSelection();
        this.saveState();
        this.checkWin();
    }

    tryMove(targetPileIndex) {
        if (!this.selectedCard) return;

        const card = this.selectedCard;
        const source = this.selectedSource;

        if (!this.canMoveToTableau(card, targetPileIndex)) {
            this.clearSelection();
            return;
        }

        // Get cards to move
        let cardsToMove = [card];
        if (source.type === 'tableau') {
            const pile = this.tableau[source.index];
            const startIndex = pile.indexOf(card);
            cardsToMove = pile.slice(startIndex);
        }

        // Remove from source
        if (source.type === 'waste') {
            this.waste.pop();
        } else if (source.type === 'tableau') {
            const pile = this.tableau[source.index];
            const startIndex = pile.indexOf(card);
            this.tableau[source.index] = pile.slice(0, startIndex);
            this.flipTopCard(source.index);
        }

        // Add to target
        this.tableau[targetPileIndex].push(...cardsToMove);

        // Update UI
        if (source.type === 'waste') {
            this.renderWaste();
        } else if (source.type === 'tableau') {
            this.renderTableauPile(source.index);
        }
        this.renderTableauPile(targetPileIndex);

        this.moves++;
        this.updateMoveCounter();
        this.clearSelection();
        this.rebindEvents();
        this.saveState();
    }

    flipTopCard(pileIndex) {
        const pile = this.tableau[pileIndex];
        if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
            pile[pile.length - 1].flip();
        }
    }

    updateMoveCounter() {
        document.getElementById('move-counter').textContent = `${this.moves} move${this.moves !== 1 ? 's' : ''}`;
    }

    rebindEvents() {
        // Exclude stock cards - they don't have cardId and would block stock click
        document.querySelectorAll('#klondike-board .card[data-card-id]').forEach(el => {
            el.onclick = (e) => this.handleCardClick(e);
        });
    }

    checkWin() {
        const totalInFoundations = SUITS.reduce((sum, suit) => sum + this.foundations[suit].length, 0);

        if (totalInFoundations === 52) {
            this.gameEnded = true;
            this.clearSavedState();
            this.celebrateWin();
            game.stats.recordGame(this.gameType, true);
        }
    }

    async celebrateWin() {
        // Animate foundation cards
        document.querySelectorAll('.foundation .card').forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('celebrate');
            }, i * 100);
        });

        await delay(800);
        game.showWinModal(this.moves);
    }

    recordLoss() {
        if (this.gameStarted && !this.gameEnded) {
            game.stats.recordGame(this.gameType, false);
        }
    }
}

// ============================================
// PYRAMID SOLITAIRE
// ============================================

class PyramidGame {
    constructor() {
        this.gameType = 'pyramid';
        this.deck = new Deck();
        this.pyramid = [];
        this.stock = [];
        this.waste = [];
        this.discarded = [];
        this.selectedCard = null;
        this.selectedSource = null;
        this.moves = 0;
        this.gameStarted = false;
        this.gameEnded = false;

        this.pyramidEl = document.getElementById('pyramid-area');
        this.stockEl = document.getElementById('pyramid-stock');
        this.wasteEl = document.getElementById('pyramid-waste');
        this.discardEl = document.getElementById('pyramid-discard');
    }

    // Serialize game state for persistence
    serialize() {
        return {
            gameType: this.gameType,
            pyramid: this.pyramid.map(row => row.map(c => c ? { suit: c.suit, rank: c.rank, row: c.row, col: c.col } : null)),
            stock: this.stock.map(c => ({ suit: c.suit, rank: c.rank })),
            waste: this.waste.map(c => ({ suit: c.suit, rank: c.rank })),
            discarded: this.discarded.map(c => ({ suit: c.suit, rank: c.rank })),
            moves: this.moves,
            gameStarted: this.gameStarted,
            gameEnded: this.gameEnded
        };
    }

    // Restore game from saved state
    async restore(state) {
        this.moves = state.moves;
        this.gameStarted = state.gameStarted;
        this.gameEnded = state.gameEnded;

        // Recreate pyramid
        this.pyramid = state.pyramid.map((row, rowIdx) => row.map((s, colIdx) => {
            if (!s) return null;
            const card = new Card(s.suit, s.rank);
            card.faceUp = true;
            card.row = rowIdx;
            card.col = colIdx;
            return card;
        }));

        this.stock = state.stock.map(s => new Card(s.suit, s.rank));
        this.waste = state.waste.map(s => { const c = new Card(s.suit, s.rank); c.faceUp = true; return c; });
        this.discarded = state.discarded.map(s => new Card(s.suit, s.rank));

        this.clearBoard();
        this.renderAll();
        this.setupEventListeners();
        this.updateMoveCounter();
    }

    renderAll() {
        // Render pyramid
        for (let row = 0; row < 7; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'pyramid-row';
            rowDiv.dataset.row = row;

            for (let col = 0; col <= row; col++) {
                const card = this.pyramid[row][col];
                const wrapper = document.createElement('div');
                wrapper.className = 'pyramid-card';
                wrapper.dataset.row = row;
                wrapper.dataset.col = col;

                if (card) {
                    wrapper.appendChild(card.createElement());
                } else {
                    wrapper.classList.add('empty');
                }

                rowDiv.appendChild(wrapper);
            }
            this.pyramidEl.appendChild(rowDiv);
        }

        this.renderStock();
        this.renderWaste();
        this.updateBlockedCards();
    }

    saveState() {
        if (this.gameStarted && !this.gameEnded) {
            const state = this.serialize();
            localStorage.setItem('solitaire-current-game', JSON.stringify(state));
        }
    }

    clearSavedState() {
        localStorage.removeItem('solitaire-current-game');
    }

    async init() {
        this.deck.reset();
        this.deck.shuffle();
        this.pyramid = [];
        this.stock = [];
        this.waste = [];
        this.discarded = [];
        this.selectedCard = null;
        this.selectedSource = null;
        this.moves = 0;
        this.gameStarted = false;
        this.gameEnded = false;

        this.clearBoard();
        await this.deal();
        this.setupEventListeners();
        this.updateMoveCounter();
    }

    clearBoard() {
        this.pyramidEl.innerHTML = '';
        this.stockEl.innerHTML = '';
        this.wasteEl.innerHTML = '';
        this.discardEl.innerHTML = '';
    }

    async deal() {
        // Create pyramid structure (7 rows)
        for (let row = 0; row < 7; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'pyramid-row';
            rowDiv.dataset.row = row;

            const rowCards = [];
            for (let col = 0; col <= row; col++) {
                const card = this.deck.draw();
                card.faceUp = true;
                card.row = row;
                card.col = col;
                rowCards.push(card);

                const wrapper = document.createElement('div');
                wrapper.className = 'pyramid-card';
                wrapper.dataset.row = row;
                wrapper.dataset.col = col;

                const el = card.createElement();
                el.classList.add('dealing');
                el.style.animationDelay = `${(row * 7 + col) * 40}ms`;
                wrapper.appendChild(el);
                rowDiv.appendChild(wrapper);
            }
            this.pyramid.push(rowCards);
            this.pyramidEl.appendChild(rowDiv);
        }

        // Rest goes to stock
        while (this.deck.cards.length > 0) {
            this.stock.push(this.deck.draw());
        }

        await delay(500);
        this.renderStock();
        this.updateBlockedCards();
        this.gameStarted = true;
    }

    renderStock() {
        this.stockEl.innerHTML = '';
        this.stockEl.classList.toggle('empty', this.stock.length === 0);

        if (this.stock.length > 0) {
            const showCount = Math.min(3, this.stock.length);
            for (let i = 0; i < showCount; i++) {
                const placeholder = document.createElement('div');
                placeholder.className = 'card face-down';
                placeholder.style.top = `${i * 2}px`;
                placeholder.style.left = `${i * 2}px`;
                this.stockEl.appendChild(placeholder);
            }
        }
    }

    renderWaste() {
        this.wasteEl.innerHTML = '';

        if (this.waste.length > 0) {
            const topCard = this.waste[this.waste.length - 1];
            topCard.faceUp = true;
            this.wasteEl.appendChild(topCard.createElement());
        }
    }

    updateBlockedCards() {
        // A card is blocked if either card below it exists
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col <= row; col++) {
                const card = this.pyramid[row][col];
                if (!card) continue;

                const leftBelow = this.pyramid[row + 1]?.[col];
                const rightBelow = this.pyramid[row + 1]?.[col + 1];
                const blocked = (leftBelow !== null && leftBelow !== undefined) ||
                               (rightBelow !== null && rightBelow !== undefined);

                const wrapper = this.pyramidEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (wrapper) {
                    wrapper.classList.toggle('blocked', blocked);
                }
            }
        }

        // Bottom row is never blocked
        this.pyramid[6].forEach((card, col) => {
            if (card) {
                const wrapper = this.pyramidEl.querySelector(`[data-row="6"][data-col="${col}"]`);
                if (wrapper) {
                    wrapper.classList.remove('blocked');
                }
            }
        });
    }

    setupEventListeners() {
        // Stock click
        this.stockEl.onclick = () => this.drawFromStock();

        // Rebind all events
        this.rebindEvents();
    }

    rebindEvents() {
        // Pyramid card clicks
        this.pyramidEl.querySelectorAll('.pyramid-card').forEach(wrapper => {
            if (!wrapper.classList.contains('blocked')) {
                const cardEl = wrapper.querySelector('.card');
                if (cardEl) {
                    cardEl.onclick = (e) => this.handleCardClick(e);
                }
            }
        });

        // Waste card click
        const wasteCard = this.wasteEl.querySelector('.card');
        if (wasteCard) {
            wasteCard.onclick = (e) => this.handleCardClick(e);
        }
    }

    drawFromStock() {
        if (this.gameEnded) return;
        this.clearSelection();

        if (this.stock.length === 0) {
            // Reset stock from waste
            while (this.waste.length > 0) {
                const card = this.waste.pop();
                card.faceUp = false;
                this.stock.push(card);
            }
        } else {
            const card = this.stock.pop();
            card.faceUp = true;
            this.waste.push(card);
            this.moves++;
            this.updateMoveCounter();
        }

        this.renderStock();
        this.renderWaste();
        this.rebindEvents();
        this.saveState();
    }

    handleCardClick(e) {
        if (this.gameEnded) return;
        e.stopPropagation();

        const cardEl = e.target.closest('.card');
        if (!cardEl) return;

        const card = this.findCardByElement(cardEl);
        if (!card || !card.faceUp) return;

        // Check if card is blocked
        const source = this.findCardSource(card);
        if (source.type === 'pyramid') {
            const wrapper = this.pyramidEl.querySelector(`[data-row="${source.row}"][data-col="${source.col}"]`);
            if (wrapper && wrapper.classList.contains('blocked')) return;
        }

        // Kings auto-remove
        if (card.value === 13) {
            this.removeCard(card, source);
            return;
        }

        if (this.selectedCard === card) {
            this.clearSelection();
            return;
        }

        if (this.selectedCard) {
            // Check if cards sum to 13
            if (this.selectedCard.value + card.value === 13) {
                const selectedSource = this.selectedSource;
                this.removeCard(this.selectedCard, selectedSource);
                this.removeCard(card, source);
                this.clearSelection();
            } else {
                // Select new card
                this.clearSelection();
                this.selectCard(card, source);
            }
        } else {
            this.selectCard(card, source);
        }
    }

    findCardByElement(el) {
        const cardId = el.dataset.cardId;

        // Check pyramid
        for (const row of this.pyramid) {
            for (const card of row) {
                if (card && card.id === cardId) return card;
            }
        }

        // Check waste
        for (const card of this.waste) {
            if (card.id === cardId) return card;
        }

        return null;
    }

    findCardSource(card) {
        // Check pyramid
        for (let row = 0; row < this.pyramid.length; row++) {
            for (let col = 0; col < this.pyramid[row].length; col++) {
                if (this.pyramid[row][col] === card) {
                    return { type: 'pyramid', row, col };
                }
            }
        }

        // Check waste
        if (this.waste.includes(card)) {
            return { type: 'waste' };
        }

        return null;
    }

    selectCard(card, source) {
        this.clearSelection();
        this.selectedCard = card;
        this.selectedSource = source;
        card.element.classList.add('selected');
    }

    clearSelection() {
        document.querySelectorAll('.card.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.selectedCard = null;
        this.selectedSource = null;
    }

    removeCard(card, source) {
        // Animate removal
        if (card.element) {
            card.element.classList.add('matched');
        }

        setTimeout(() => {
            if (source.type === 'pyramid') {
                this.pyramid[source.row][source.col] = null;
                const wrapper = this.pyramidEl.querySelector(`[data-row="${source.row}"][data-col="${source.col}"]`);
                if (wrapper) {
                    wrapper.innerHTML = '';
                    wrapper.classList.add('empty');
                }
                this.updateBlockedCards();
            } else if (source.type === 'waste') {
                this.waste.pop();
                this.renderWaste();
            }

            this.discarded.push(card);
            this.moves++;
            this.updateMoveCounter();
            this.rebindEvents();
            this.saveState();
            this.checkWin();
        }, 200);
    }

    updateMoveCounter() {
        document.getElementById('move-counter').textContent = `${this.moves} move${this.moves !== 1 ? 's' : ''}`;
    }

    checkWin() {
        // Win if all pyramid cards are removed
        const pyramidEmpty = this.pyramid.every(row => row.every(card => card === null));

        if (pyramidEmpty) {
            this.gameEnded = true;
            this.clearSavedState();
            game.stats.recordGame(this.gameType, true);
            setTimeout(() => {
                game.showWinModal(this.moves);
            }, 300);
        }
    }

    recordLoss() {
        if (this.gameStarted && !this.gameEnded) {
            game.stats.recordGame(this.gameType, false);
        }
    }
}

// ============================================
// MAIN GAME CONTROLLER
// ============================================

class GameController {
    constructor() {
        this.currentGame = null;
        this.currentGameType = null;
        this.stats = new Statistics();

        this.screens = {
            menu: document.getElementById('menu-screen'),
            game: document.getElementById('game-screen'),
            stats: document.getElementById('stats-screen')
        };

        this.boards = {
            klondike: document.getElementById('klondike-board'),
            pyramid: document.getElementById('pyramid-board')
        };

        this.setupNavigation();
        this.checkSavedGame();
    }

    checkSavedGame() {
        const saved = localStorage.getItem('solitaire-current-game');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                if (state && state.gameType && state.gameStarted && !state.gameEnded) {
                    this.restoreSavedGame(state);
                }
            } catch (e) {
                console.error('Failed to restore saved game:', e);
                localStorage.removeItem('solitaire-current-game');
            }
        }
    }

    async restoreSavedGame(state) {
        this.currentGameType = state.gameType;

        // Hide all boards
        Object.values(this.boards).forEach(board => {
            board.classList.add('hidden');
        });

        // Set title and create game
        let title = '';
        if (state.gameType === 'klondike1' || state.gameType === 'klondike3') {
            title = state.gameType === 'klondike1' ? 'Klondike (Draw 1)' : 'Klondike (Draw 3)';
            this.boards.klondike.classList.remove('hidden');
            this.currentGame = new KlondikeGame(state.drawCount);
        } else if (state.gameType === 'pyramid') {
            title = 'Pyramid';
            this.boards.pyramid.classList.remove('hidden');
            this.currentGame = new PyramidGame();
        }

        document.getElementById('game-title').textContent = title;
        this.showScreen('game');
        this.hideWinModal();
        await this.currentGame.restore(state);
    }

    setupNavigation() {
        // Menu buttons
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.onclick = () => this.startGame(btn.dataset.game);
        });

        // Stats button
        document.getElementById('show-stats').onclick = () => this.showStats();

        // Back buttons
        document.getElementById('back-btn').onclick = () => this.backToMenu();
        document.getElementById('stats-back-btn').onclick = () => this.showScreen('menu');

        // New game button
        document.getElementById('new-game-btn').onclick = () => this.newGame();

        // Win modal buttons
        document.getElementById('play-again').onclick = () => this.newGame();
        document.getElementById('back-to-menu').onclick = () => this.backToMenu();

        // Reset stats
        document.getElementById('reset-stats').onclick = () => {
            if (confirm('Reset all statistics?')) {
                this.stats.reset();
                this.updateStatsDisplay();
            }
        };
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        this.screens[screenName].classList.add('active');
    }

    startGame(gameType) {
        this.currentGameType = gameType;

        // Hide all boards
        Object.values(this.boards).forEach(board => {
            board.classList.add('hidden');
        });

        // Set title
        let title = '';
        if (gameType === 'klondike1') {
            title = 'Klondike (Draw 1)';
            this.boards.klondike.classList.remove('hidden');
            this.currentGame = new KlondikeGame(1);
        } else if (gameType === 'klondike3') {
            title = 'Klondike (Draw 3)';
            this.boards.klondike.classList.remove('hidden');
            this.currentGame = new KlondikeGame(3);
        } else if (gameType === 'pyramid') {
            title = 'Pyramid';
            this.boards.pyramid.classList.remove('hidden');
            this.currentGame = new PyramidGame();
        }

        document.getElementById('game-title').textContent = title;
        this.showScreen('game');
        this.hideWinModal();
        this.currentGame.init();
    }

    newGame() {
        if (this.currentGame) {
            this.currentGame.recordLoss();
            this.currentGame.clearSavedState();
        }
        this.hideWinModal();
        this.startGame(this.currentGameType);
    }

    backToMenu() {
        // Don't record loss - game is saved and can be resumed
        this.hideWinModal();
        this.showScreen('menu');
    }

    showStats() {
        this.updateStatsDisplay();
        this.showScreen('stats');
    }

    updateStatsDisplay() {
        const k1 = this.stats.getStats('klondike1');
        const k3 = this.stats.getStats('klondike3');
        const pyr = this.stats.getStats('pyramid');

        document.getElementById('k1-played').textContent = k1.played;
        document.getElementById('k1-won').textContent = k1.won;
        document.getElementById('k1-rate').textContent = `${k1.rate}%`;

        document.getElementById('k3-played').textContent = k3.played;
        document.getElementById('k3-won').textContent = k3.won;
        document.getElementById('k3-rate').textContent = `${k3.rate}%`;

        document.getElementById('pyr-played').textContent = pyr.played;
        document.getElementById('pyr-won').textContent = pyr.won;
        document.getElementById('pyr-rate').textContent = `${pyr.rate}%`;
    }

    showWinModal(moves) {
        document.getElementById('final-moves').textContent = moves;
        document.getElementById('win-modal').classList.remove('hidden');
    }

    hideWinModal() {
        document.getElementById('win-modal').classList.add('hidden');
    }
}

// ============================================
// INITIALIZE
// ============================================

const game = new GameController();
