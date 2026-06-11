/* --- ARCADE AUDIO ENGINE --- */

// Initialize the browser's native AudioContext
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/**
 * Plays the rapid mechanical clicking noise while the wheel rotates
 */
function playTickSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

/**
 * Handles the win/selection sound effect presets
 * @param {string} soundType - The preset key ('arcade_levelup', 'retro_coin', etc.)
 */
function playSelectionSound(soundType) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    switch(soundType) {
        case 'arcade_levelup':
            const notes = [440, 554, 659, 880, 1109];
            notes.forEach((freq, index) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime + index * 0.07);
                gain.gain.setValueAtTime(0.12, audioCtx.currentTime + index * 0.07);
                gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + index * 0.07 + 0.3);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + index * 0.07);
                osc.stop(audioCtx.currentTime + index * 0.07 + 0.3);
            });
            break;

        case 'retro_coin':
            const coinFreqs = [987.77, 1318.51];
            coinFreqs.forEach((freq, index) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime + index * 0.08);
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime + index * 0.08);
                gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + index * 0.08 + 0.35);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + index * 0.08);
                osc.stop(audioCtx.currentTime + index * 0.08 + 0.35);
            });
            break;

        case 'space_laser':
            const laserOsc = audioCtx.createOscillator();
            const laserGain = audioCtx.createGain();
            laserOsc.type = 'sawtooth';
            laserOsc.frequency.setValueAtTime(1500, audioCtx.currentTime);
            laserOsc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.5);
            laserGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            laserGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            laserOsc.connect(laserGain);
            laserGain.connect(audioCtx.destination);
            laserOsc.start();
            laserOsc.stop(audioCtx.currentTime + 0.5);
            break;

        case 'epic_fanfare':
            const brassFreqs = [261.63, 329.63, 392.00, 523.25];
            brassFreqs.forEach((freq, index) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime + (index * 0.02));
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.8);
            });
            break;
    }
}