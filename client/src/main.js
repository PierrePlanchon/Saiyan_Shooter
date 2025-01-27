import HomeView from './views/HomeView.js';
import Router from './Router.js';
import View from './views/View.js';
import GameView from './views/GameView.js';
import ScoreView from './views/ScoreView.js';
import Player from './models/Player.js';
import {
	CONTROL_KEYS,
	PAUSE_KEYS,
	SHOOT_KEYS,
	ULTI_KEYS,
} from './settings/keys.js';
import Game from './models/Game.js';
import { io } from 'socket.io-client';
import Ennemy from './models/Ennemy.js';
import Item from './models/Item.js';
import Projectile from './models/Projectile.js';
import { Assets, Text, Texture } from 'pixi.js';
import { loadSprites, spritesData } from './sprites.js';
import { playSound } from './utils.js';

const socket = io();

const game = new Game(window.screen.width, window.screen.height);

const homeView = new HomeView(document.querySelector('.home'));
const guideView = new View(document.querySelector('.guide'));
const gameView = new GameView(game, document.querySelector('.game'));
const scoreView = new ScoreView(document.querySelector('.scores'));
const creditsView = new View(document.querySelector('.credits'));

const routes = [
	{ path: '/', view: homeView, title: 'Accueil' },
	{ path: '/guide', view: guideView, title: 'Guide' },
	{ path: '/game', view: gameView, title: 'Jeu' },
	{ path: '/scores', view: scoreView, title: 'Tableau des scores' },
	{ path: '/credits', view: creditsView, title: 'Crédits' },
];

async function loadTextures() {
	for (let i = 0; i < 9; i++) {
		const path = `/assets/sprites/player-${i}.json`;
		await Assets.load(path);
	}
	await Assets.load('/assets/sprites/projectile-0.json');
	await loadSprites();
}

const keysDown = new Set();

document.addEventListener('keydown', event => {
	const key = event.key.toUpperCase();
	if (CONTROL_KEYS.includes(key)) {
		if (!keysDown.has(key)) {
			keysDown.add(key);
			socket.emit('keydown', key);
		}
	} else if (PAUSE_KEYS.includes(key)) {
		gameView.togglePause();
	} else if (SHOOT_KEYS.includes(key)) {
		if (!keysDown.has(key)) {
			keysDown.add(key);
			socket.emit('shoot', 'basic');
		}
	} else if (ULTI_KEYS.includes(key)) {
		if (!keysDown.has(key)) {
			keysDown.add(key);
			socket.emit('shoot', 'ulti');
		}
	}
});

document.addEventListener('keyup', event => {
	const key = event.key.toUpperCase();
	keysDown.delete(key);
	if (CONTROL_KEYS.includes(key)) {
		socket.emit('keyup', key);
	} else if (SHOOT_KEYS.includes(key)) {
		// player.shoot();
	}
});

socket.on('difficulty', difficulty => (homeView.difficulty = difficulty));

socket.on('sfx', sfx => {
	playSound(`/assets/sfx/${sfx}`);
});

homeView.onCharacterChange = characterId => {
	socket.emit('character', characterId);
};

function onStart() {
	if (homeView.gameId.length !== 0) {
		socket.emit('join', homeView.gameId);
	}
	socket.emit('start', homeView.username);
	Router.navigate('/game');
}

homeView.onStartPressed = onStart;
gameView.onReplayPressed = () => {
	socket.emit('start', homeView.username);
};
gameView.onHide = () => {
	socket.emit('leave');
};

Router.routes = routes;
const links = document.querySelectorAll('a, button[href]');

Router.navigate(window.location.pathname, true);
window.onpopstate = () => Router.navigate(document.location.pathname, true);
links.forEach(a => {
	a.addEventListener('click', event => {
		event.preventDefault();
		Router.navigate(a.getAttribute('href'));
	});
});

homeView.setLoading(true);
loadTextures().then(() => {
	homeView.setLoading(false);
	homeView.onDifficultyClick = difficulty => {
		socket.emit('difficulty', difficulty);
	};

	socket.on('game', gameData => {
		const { width, height, players, items, projectiles, ennemies } = gameData;
		gameView.dimensions = { width, height };
		game.id = gameData.id;
		game.dimensions = { width, height };
		game.maxEnemies = gameData.maxEnemies;
		game.currentWave = gameData.currentWave;
		game.nbKillsInWave = gameData.nbKillsInWave;
		homeView.difficulty = gameData.difficulty;
		game.players = players.map(p => {
			let player = game.findPlayerById(p.id);
			if (!player) {
				player = new Player(p.characterId);
				player.dimensions = { width: p.width, height: p.height };
				player.id = p.id;
			}
			if (p.id == socket.id) {
				gameView.currentPlayer = player;
			}
			player.username = p.username;
			player.setMoving(p.moving);
			player.position.set(p.x, p.y);
			player.score = p.score;
			player.kills = p.kills;
			player.ult = p.ult;
			if (p.life < player.life) {
				player.hitAnimation();
			} else {
				player.invicibility = p.invicibility;
			}
			player.setLife(p.life);
			if (p.characterId !== player.characterId) {
				player.setSprites(p.characterId);
				player.dimensions = { width: p.width, height: p.height };
			}
			if (p.width !== player.width || p.height !== player.height) {
				player.dimensions = { width: p.width, height: p.height };
			}
			return player;
		});
		game.ennemies = ennemies.map(e => {
			let ennemy = game.findEnnemyById(e.id);
			if (!ennemy) {
				ennemy = new Ennemy(e.name);
				ennemy.id = e.id;
			}
			ennemy.position.set(e.x, e.y);
			ennemy.dimensions = { width: e.width, height: e.height };
			ennemy.status = e.status;
			if (e.life < ennemy.life) {
				ennemy.hitAnimation(500);
			}
			ennemy.life = e.life;
			return ennemy;
		});
		game.items = items.map(i => {
			const item = new Item(i.name, i.lifetime);
			item.position.set(i.x, i.y);
			item.dimensions = { width: i.width, height: i.height };
			item.angle = i.angle;
			return item;
		});
		game.projectiles = projectiles.map(p => {
			const projectile = new Projectile(p.characterId, p.ulti, p.index);
			projectile.position.set(p.x, p.y);
			projectile.dimensions = { width: p.width, height: p.height };
			return projectile;
		});
		gameView.children = game.children;
		game.duration = gameData.duration;
		gameView.update();
	});
});
