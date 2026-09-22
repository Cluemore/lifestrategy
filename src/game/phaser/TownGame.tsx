import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { useGameStore } from '../../store/gameStore';
import { LOCATION_EVENT, type LocationInteractionSource, WORLD_LOCATIONS, type WorldLocation } from '../data/locations';

class TownScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Container;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  interact!: Phaser.Input.Keyboard.Key;
  prompt!: Phaser.GameObjects.Text;
  activeSpot?: WorldLocation;

  constructor() { super('town'); }

  create() {
    const width = 1200;
    const height = 590;
    const journey = useGameStore.getState();
    const graphics = this.add.graphics();
    this.cameras.main.setBackgroundColor('#79d2ef');
    graphics.fillStyle(0xb7e9f5).fillRect(0, 0, width, 230);
    graphics.fillStyle(0x86cf91).fillRect(0, 230, width, 360);
    graphics.fillStyle(0x5cc9d7).fillRoundedRect(0, 470, width, 120, 0);
    graphics.fillStyle(0xf5d492).fillRoundedRect(0, 447, width, 34, 16);
    for (let index = 0; index < 7; index += 1) {
      graphics.fillStyle(index % 2 ? 0xf9b8b1 : 0xffe18b).fillRoundedRect(40 + index * 190, 50 + (index % 2) * 24, 125, 70, 14);
      graphics.fillStyle(0x6ea886).fillTriangle(30 + index * 190, 55, 102 + index * 190, 5, 175 + index * 190, 55);
    }
    for (let index = 0; index < 16; index += 1) {
      graphics.fillStyle(index % 3 === 0 ? 0xf8a6b8 : 0xffe276).fillCircle(30 + index * 78, 300 + (index % 2) * 22, 7);
      graphics.fillStyle(0x4a9a69).fillRect(28 + index * 78, 306 + (index % 2) * 22, 4, 30);
    }
    const garden = Math.min(8, Math.floor((journey.scores.growth + journey.scores.wealth) / 18));
    for (let index = 0; index < garden; index += 1) {
      graphics.fillStyle(0x347e62).fillCircle(80 + index * 25, 270 - (index % 2) * 12, 12);
      graphics.fillStyle(0xf1a2b2).fillCircle(80 + index * 25, 263 - (index % 2) * 12, 4);
    }
    if (journey.inventory.some((item) => item.name.includes('Laptop'))) this.add.text(91, 220, '💻', { fontSize: '22px' });
    if (journey.inventory.some((item) => item.name.includes('certificate'))) this.add.text(1010, 255, '📜', { fontSize: '22px' });
    if (journey.inventory.some((item) => item.name.includes('ticket'))) this.add.text(725, 320, '✉️', { fontSize: '22px' });
    if (journey.state.emergencyFund >= journey.state.essentialExpenses) this.add.text(525, 285, '🫙', { fontSize: '20px' });
    if (journey.state.debt > journey.state.monthlyIncome) this.add.text(75, 300, 'BILLS', { fontFamily: 'Nunito', fontSize: '11px', color: '#8d5a4f', backgroundColor: '#fff0cf', padding: { x: 6, y: 3 } }).setAngle(-6);
    graphics.lineStyle(3, 0x345d5b, 0.25);
    for (let y = 485; y < 585; y += 28) graphics.strokeLineShape(new Phaser.Geom.Line(0, y, width, y + 8));

    WORLD_LOCATIONS.forEach((spot) => {
      const building = this.add.rectangle(spot.x, spot.y, spot.w, spot.h, spot.color, 1).setStrokeStyle(4, 0x355f5d).setInteractive({ useHandCursor: true });
      building.setName(`location:${spot.id}`);
      this.add.text(spot.x, spot.y - 13, spot.icon, { fontSize: '29px' }).setOrigin(0.5);
      this.add.text(spot.x, spot.y + 27, spot.label, { fontFamily: 'Nunito', fontStyle: 'bold', fontSize: '13px', color: '#294a4a' }).setOrigin(0.5);
      building.on('pointerover', () => this.tweens.add({ targets: building, scale: 1.05, duration: 150 }));
      building.on('pointerout', () => this.tweens.add({ targets: building, scale: 1, duration: 150 }));
      building.on('pointerdown', () => this.enter(spot, 'pointer'));
    });
    this.add.text(522, 325, 'LIFEWAY CANAL', { fontFamily: 'Nunito', fontSize: '14px', fontStyle: 'bold', color: '#367a77' });
    const body = this.add.circle(0, 0, 17, 0xf392a9).setStrokeStyle(3, 0x355f5d);
    const head = this.add.circle(0, -26, 13, 0xf8c9a8).setStrokeStyle(3, 0x355f5d);
    const hat = this.add.ellipse(0, -38, 35, 10, 0xffd26e).setStrokeStyle(2, 0x355f5d);
    this.player = this.add.container(360, 280, [body, head, hat]);
    this.tweens.add({ targets: this.player, y: '-=5', yoyo: true, repeat: -1, duration: 650, ease: 'Sine.inOut' });
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.interact = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.prompt = this.add.text(0, 0, '', { fontFamily: 'Nunito', fontSize: '13px', color: '#264f4c', backgroundColor: '#fff2d6dd', padding: { x: 10, y: 5 } }).setOrigin(0.5).setVisible(false).setDepth(10);
    this.add.text(30, 540, 'WASD / arrow keys to wander  •  walk near a place and press E  •  or click a building', { fontFamily: 'Nunito', fontSize: '14px', color: '#264f4c', backgroundColor: '#fff2d6cc', padding: { x: 12, y: 7 } });
  }

  enter(spot: WorldLocation, source: LocationInteractionSource) {
    // Dispatch the typed ID from the same registry that constructed this hitbox.
    // A Bank click therefore cannot inherit a Café label, route or stale modal key.
    window.dispatchEvent(new CustomEvent(LOCATION_EVENT, { detail: { locationId: spot.id, source } }));
  }

  insideBuilding(x: number, y: number) {
    return WORLD_LOCATIONS.some((spot) => x > spot.x - spot.w / 2 + 6 && x < spot.x + spot.w / 2 - 6 && y > spot.y - spot.h / 2 + 16 && y < spot.y + spot.h / 2 - 6);
  }

  nearestSpot() {
    let closest: WorldLocation | undefined;
    let distance = Number.POSITIVE_INFINITY;
    WORLD_LOCATIONS.forEach((spot) => {
      const candidate = Phaser.Math.Distance.Between(this.player.x, this.player.y, spot.x, spot.y);
      if (candidate < distance) { distance = candidate; closest = spot; }
    });
    return distance < 118 ? closest : undefined;
  }

  update() {
    let dx = 0;
    let dy = 0;
    const speed = 3;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= speed;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += speed;
    if (this.keys.W.isDown || this.keys.UP.isDown) dy -= speed;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += speed;
    const nextX = Phaser.Math.Clamp(this.player.x + dx, 20, 1180);
    const nextY = Phaser.Math.Clamp(this.player.y + dy, 245, 525);
    if (!this.insideBuilding(nextX, this.player.y)) this.player.x = nextX;
    if (!this.insideBuilding(this.player.x, nextY)) this.player.y = nextY;
    this.activeSpot = this.nearestSpot();
    if (this.activeSpot) {
      this.prompt.setText(`Press E to enter ${this.activeSpot.label}`).setPosition(this.player.x, this.player.y - 70).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.interact)) this.enter(this.activeSpot, 'keyboard');
    } else this.prompt.setVisible(false);
  }
}

export default function TownGame() {
  const ref = useRef<HTMLDivElement>(null);
  const month = useGameStore((state) => state.month);
  const wealth = useGameStore((state) => state.scores.wealth);
  const growth = useGameStore((state) => state.scores.growth);
  const inventory = useGameStore((state) => state.inventory.length);
  const emergency = useGameStore((state) => state.state.emergencyFund);
  const debt = useGameStore((state) => state.state.debt);
  useEffect(() => {
    if (!ref.current) return;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: ref.current, width: 1200, height: 590, backgroundColor: '#79d2ef', scene: TownScene, render: { antialias: true } });
    return () => game.destroy(true);
  }, [month, wealth, growth, inventory, emergency, debt]);
  return <div ref={ref} className="town-canvas" aria-label="Explorable Lifeway town" />;
}
