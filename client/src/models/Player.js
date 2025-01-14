import * as PIXI from 'pixi.js';
import Projectile from './Projectile.js';
import Character, { ANIMATION_TIME } from './Character.js';
import * as SFX from '../consts/sfx.js';
import { playSound } from '../utils.js';
import { SPRITES_PATH } from '../consts/sprites.js';
import { spritesData } from '../sprites.js';

export const LIFE = 3;
export const SCORE = 0;
export const KILL_FOR_ULTI = 10;

/**
 * Représente un joueur.
 */
export default class Player extends Character {
	score = SCORE;
	life;
	ult;
	username;
	#moving = { up: false, down: false, left: false, right: false };
	onShoot;
	onScoreChange = [];
	onLifeChange = [];
	onKillsChange = [];
	onUltChange = [];
	characterId;
	#kills;
	#ult;
	id;
	#invicibility = false;

	constructor(characterId) {
		super(PIXI.Texture.from(`${SPRITES_PATH}player/${characterId}/player.png`));
		this.characterId = characterId;
		this.#kills = 0;
	}

	incrementNbKill() {
		this.kills = this.kills + 1;
	}

	get canUlt() {
		return this.#kills >= KILL_FOR_ULTI;
	}

	set kills(value) {
		this.#kills = value;
		this.onKillsChange.forEach(callback => callback(this.#kills));
	}

	get kills() {
		return this.#kills;
	}

	set ult(value) {
		this.#ult = value;
		this.onUltChange.forEach(callback => callback(this.#ult));
	}

	get ult() {
		return this.#ult;
	}

	set dimensions({ width, height }) {
		this.scaleValue = width / this.width;
		this.width = width;
		this.height = height;
	}

	get invicibility() {
		return this.#invicibility;
	}

	set invicibility(value) {
		if (!this.redFilter.enabled) {
			this.#invicibility = value;
			this.greenFilter.enabled = value;
		}
	}

	/**
	 * Ajoute un écouteur d'évènement.
	 * @param {string} event L'évènement à écouter.
	 * @param {function} callback La fonction à appeler lors de l'évènement.
	 */
	addEventListener(event, callback) {
		switch (event) {
			case 'lifeChange':
				this.onLifeChange.push(callback);
				break;
			case 'scoreChange':
				this.onScoreChange.push(callback);
				break;
			case 'killsChange':
				this.onKillsChange.push(callback);
				break;
			case 'ultChange':
				this.onUltChange.push(callback);
				break;
		}
	}

	/**
	 * Retourne si le joueur est en mouvement.
	 * @readonly
	 */
	get moving() {
		return this.#moving;
	}

	setMoving(moves) {
		if (this.playing) return;
		let nbDirection = 0;
		Object.keys(this.#moving).forEach(direction => {
			if (moves[direction]) {
				this.#moving[direction] = true;
				const path = `${SPRITES_PATH}player/${this.characterId}/${direction}.png`;
				const texture = PIXI.Texture.from(path);
				this.texture = texture;
				this.scale.set(this.scaleValue);
				nbDirection++;
			}
		});
		if (nbDirection === 0) {
			this.texture = PIXI.Texture.from(
				`${SPRITES_PATH}player/${this.characterId}/player.png`
			);
		}
	}

	get kills() {
		return this.#kills;
	}

	/**
	 * Retourne si le joueur est en vie.
	 * @returns {boolean} Vrai si le joueur est en vie, faux sinon.
	 * @readonly
	 */
	get alive() {
		return this.life > 0;
	}

	/**
	 * Retourne la vie du joueur.
	 * @returns {number} La vie du joueur.
	 */
	getLife() {
		return this.life;
	}

	/**
	 * Modifie la vie du joueur.
	 * @param {number} value La nouvelle vie du joueur.
	 */
	setLife(value) {
		this.life = value;
		this.onLifeChange.forEach(callback => callback(this.life));
		if (!this.alive) this.alpha = 0.3;
		else this.alpha = 1;
	}

	/**
	 * Met à jour les sprites du joueur.
	 * @param {String} spritesName le nom des sprites à aller chercher.
	 */
	setSprites(spritesName) {
		this.characterId = spritesName;
		if (spritesName !== 'goku' && spritesName !== 'vegeta') {
			const spritesNames = Object.keys(spritesData[spritesName]).filter(name =>
				name.startsWith('transfo_')
			);
			this.textures = spritesNames.map(name =>
				PIXI.Texture.from(`${SPRITES_PATH}player/${spritesName}/${name}.png`)
			);
			this.loop = false;
			this.animationSpeed = 0.1;
			this.play();
		}
	}

	/**
	 * Incrémente le score du joueur.
	 */
	incrementScore() {
		this.score++;
		this.onScoreChange.forEach(callback => callback(this.score));
	}

	/**
	 * Décrémente la vie du joueur.
	 */
	decrementLife() {
		this.life--;
		this.onLifeChange.forEach(callback => callback(this.life));
		this.hitAnimation();
	}

	/**
	 * Réinitialise le score et la vie du joueur.
	 */
	reset() {
		if (this.characterId === 'kaioken' || this.characterId === 'ssj')
			this.characterId = 'goku';
		this.texture = PIXI.Texture.from(
			`${SPRITES_PATH}player/${this.characterId}/player.png`
		);
		this.score = SCORE;
		this.life = LIFE;
		this.kills = 0;
		this.onScoreChange.forEach(callback => callback(this.score));
		this.onLifeChange.forEach(callback => callback(this.life));
	}

	/**
	 * Déplace le joueur.
	 * @param {number} x Le déplacement horizontal.
	 * @param {number} y Le déplacement vertical.
	 */
	move(x, y) {
		this.x += x;
		this.y += y;
	}

	/**
	 * Fait tirer le joueur.
	 */
	shoot() {
		if (!this.alive) return;
		const projectile = new Projectile(this.characterId);
		projectile.position = this.position;
		projectile.move('right');
		playSound(SFX.PROJECTILE);
		this.texture = PIXI.Texture.from(
			`${SPRITES_PATH}player/${this.characterId}/shooting.png`
		);
		if (this.onShoot) {
			this.onShoot(projectile);
		}
		setTimeout(
			() =>
				(this.texture = PIXI.Texture.from(
					`${SPRITES_PATH}player/${this.characterId}/player.png`
				)),
			ANIMATION_TIME
		);
	}

	/**
	 * Lance une attaque ultime
	 */
	ulti() {
		if (!this.alive || !this.canUlt) return;
		this.textures = PIXI.Assets.get(`${this.characterId}/ult`);
		this.animationSpeed = 0.25;
		this.loop = false;
		this.onComplete = () => {
			const projectile = new Projectile(this.characterId, true);
			projectile.position = this.position;
			projectile.move('right');
			playSound(SFX.PROJECTILE);
			this.texture = PIXI.Assets.get(`${this.characterId}/shooting.png`);
			if (this.onShoot) {
				this.onShoot(projectile);
			}
			this.texture = PIXI.Assets.get(`${this.characterId}/player.png`);
		};
		this.play();

		this.kills = -1;
	}

	reload() {
		this.texture = PIXI.Assets.get(`${this.characterId}/reloading.png`);
	}
	/**
	 * Fait tomber le joueur.
	 * @returns {Promise<void>} Une promesse qui se résout lorsque l'animation est terminée.
	 */
	fallAnimation() {
		// this.textures = sprites[this.#id].falling_sprites;
		// this.loop = false;
		// this.animationSpeed = 0.5;
		// this.play();
		// const initialOnComplete = this.onComplete;
		// return new Promise(
		// 	resolve =>
		// 		(this.onComplete = () => {
		// 			resolve();
		// 			this.onComplete = initialOnComplete;
		// 		})
		// );
		this.texture = PIXI.Assets.get(`${this.characterId}/ko.png`);
	}
}
