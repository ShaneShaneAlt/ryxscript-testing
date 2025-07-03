// RyxScript.js - The All-in-One Runtime & Transpiler v0.1.2
// (c) 2023 [Your Name] - For demonstration purposes
// FIX: Strips type annotations from `init` and `on` block parameters.

(function() {
    'use strict';

    // ========================================================================
    // 1. RYX RUNTIME & ENGINE
    // ========================================================================
    const Ryx = {
        entities: [],
        main: () => { console.warn("RyxScript: No 'main' block found."); },
        canvas: null,
        ctx: null,
        lastTime: 0,
        deltaTime: 0,

        // --- Core Data Types ---
        Vector2: class Vector2 {
            constructor(x = 0, y = 0) { this.x = x; this.y = y; }
            add(v) { return new Ryx.Vector2(this.x + v.x, this.y + v.y); }
            multiply(scalar) { return new Ryx.Vector2(this.x * scalar, this.y * scalar); }
        },
        Color: class Color {
            constructor(r, g, b, a = 1.0) { this.r = r; this.g = g; this.b = b; this.a = a; }
            toString() { return `rgba(${this.r},${this.g},${this.b},${this.a})`; }
            static fromHex(hex) {
                let r = 0, g = 0, b = 0;
                if (hex.length == 4) {
                    r = parseInt(hex[1] + hex[1], 16);
                    g = parseInt(hex[2] + hex[2], 16);
                    b = parseInt(hex[3] + hex[3], 16);
                } else if (hex.length == 7) {
                    r = parseInt(hex[1] + hex[2], 16);
                    g = parseInt(hex[3] + hex[4], 16);
                    b = parseInt(hex[5] + hex[6], 16);
                }
                return new Ryx.Color(r, g, b, 1);
            }
        },

        // --- Entity System ---
        Entity: class Entity {
            constructor() { this._isDestroyed = false; }
            tick(delta) {}
            render() {}
            on(eventName, data) {
                const handlerName = `on_${eventName}`;
                if (typeof this[handlerName] === 'function') {
                    this[handlerName](data);
                }
            }
            destroy() { this._isDestroyed = true; }
        },
        spawn: function(EntityType, ...args) {
            const entity = new EntityType(...args);
            this.entities.push(entity);
            return entity;
        },
        emit: function(eventName, data) {
            for (const entity of this.entities) {
                entity.on(eventName, data);
            }
        },

        // --- Graphics Module (Gfx) ---
        Gfx: {
            setResolution(w, h) {
                Ryx.canvas.width = w;
                Ryx.canvas.height = h;
            },
            get width() { return Ryx.canvas.width; },
            get height() { return Ryx.canvas.height; },
            setBackground(color) {
                Ryx.ctx.fillStyle = color.toString();
                Ryx.ctx.fillRect(0, 0, this.width, this.height);
            },
            fill(color) { Ryx.ctx.fillStyle = color.toString(); },
            stroke(color) { Ryx.ctx.strokeStyle = color.toString(); },
            noFill() { Ryx.ctx.fillStyle = "transparent"; },
            noStroke() { Ryx.ctx.strokeStyle = "transparent"; },
            drawCircle(pos, radius) {
                Ryx.ctx.beginPath();
                Ryx.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
                Ryx.ctx.fill();
                Ryx.ctx.stroke();
            },
            drawImage(image, pos) {
                Ryx.ctx.drawImage(image, pos.x - image.width / 2, pos.y - image.height / 2);
            }
        },

        // --- Input Module ---
        Input: {
            _keys: new Set(),
            getVector(left, right, up, down) {
                let x = 0, y = 0;
                if (this._keys.has(left)) x -= 1;
                if (this._keys.has(right)) x += 1;
                if (this._keys.has(up)) y -= 1;
                if (this._keys.has(down)) y += 1;
                const len = Math.sqrt(x*x + y*y);
                if (len > 0) {
                    return new Ryx.Vector2(x / len, y / len);
                }
                return new Ryx.Vector2(0, 0);
            }
        },

        // --- Game Loop ---
        _gameLoop: function(timestamp) {
            this.deltaTime = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;

            for (let i = this.entities.length - 1; i >= 0; i--) {
                const entity = this.entities[i];
                if (entity._isDestroyed) {
                    this.entities.splice(i, 1);
                } else {
                    entity.tick(this.deltaTime);
                }
            }

            for (const entity of this.entities) {
                entity.render();
            }

            requestAnimationFrame(this._gameLoop.bind(this));
        },

        // --- Initialization ---
        _init: function() {
            this.canvas = document.getElementById('ryx-canvas');
            if (!this.canvas) {
                console.error("RyxScript Error: Canvas with id 'ryx-canvas' not found!");
                return;
            }
            this.ctx = this.canvas.getContext('2d');
            
            window.addEventListener('keydown', e => Ryx.Input._keys.add(e.key));
            window.addEventListener('keyup', e => Ryx.Input._keys.delete(e.key));

            this._loadAndTranspileScripts();
        },

        _start: function() {
            this.main();
            this.lastTime = performance.now();
            requestAnimationFrame(this._gameLoop.bind(this));
        }
    };

    window.Ryx = Ryx;

    // ========================================================================
    // 2. RYX TRANSPILER
    // ========================================================================
    function transpile(ryxCode) {
        let jsCode = ryxCode;

        jsCode = jsCode.replace(/\/\/.*/g, '');
        jsCode = jsCode.replace(/\bmain\s*->([\s\S]*?)end/g, 'Ryx.main = () => {$1};');

        jsCode = jsCode.replace(/\bentity\s+(\w+)([\s\S]*?)end/g, (match, name, content) => {
            let constructorContent = '';
            
            content = content.replace(/\b(prop|state)\s+([\w\d]+)\s*:\s*[\w\d<>\/]+(?:\s*=\s*([\s\S]*?))?(?=\n\s*(prop|state|init|tick|render|on|end))/g,
                (match, type, name, value) => {
                    if (value !== undefined) {
                        constructorContent += `this.${name} = ${value.trim()};\n`;
                    } else {
                        constructorContent += `this.${name} = undefined;\n`;
                    }
                    return '';
                });
            
            // *** THE FIRST FIX IS HERE ***
            content = content.replace(/\binit\s*\((.*?)\)\s*->([\s\S]*?)end/g,
                (match, params, body) => {
                    const cleanParams = params.replace(/:\s*[\w\d<>]+/g, ''); // Strip types
                    return `constructor(${cleanParams}) { super(); ${constructorContent} ${body}}`;
                });
            
            if (!/constructor/.test(content)) {
                content = `constructor() { super(); ${constructorContent} }` + content;
            }

            content = content.replace(/\btick\s*->([\s\S]*?)end/g, 'tick(delta) {$1}');
            content = content.replace(/\brender\s*->([\s\S]*?)end/g, 'render() {$1}');
            
            // *** THE SECOND FIX IS HERE ***
            content = content.replace(/\bon\s+'([\w_]+)'\s*\((.*?)\)\s*->([\s\S]*?)end/g,
                (match, eventName, params, body) => {
                    const cleanParams = params.replace(/:\s*[\w\d<>]+/g, ''); // Strip types
                    return `on_${eventName}(${cleanParams}) {${body}}`;
                });

            return `class ${name} extends Ryx.Entity {${content}}`;
        });
        
        jsCode = jsCode.replace(/\bif\s+(.+?)\s+then/g, 'if ($1) {');
        jsCode = jsCode.replace(/\belse\s*if\s+(.+?)\s+then/g, '} else if ($1) {');
        jsCode = jsCode.replace(/\belse/g, '} else {');
        jsCode = jsCode.replace(/\bloop\s+(\w+)\s+from\s+([\d\w.]+)\s+to\s+([\d\w.]+)\s*->/g, 'for (let $1 = $2; $1 < $3; $1++) {');
        jsCode = jsCode.replace(/\bend\b/g, '}');
        jsCode = jsCode.replace(/\bspawn\s*\((.*?)\)/g, 'Ryx.spawn($1)');
        jsCode = jsCode.replace(/<[\w\d\/]+>/g, '');
        jsCode = js_code.replace(/(\b[A-Z]\w+)::/g, 'Ryx.$1.');

        return jsCode;
    }

    // ========================================================================
    // 3. SCRIPT LOADER
    // ========================================================================
    Ryx._loadAndTranspileScripts = async function() {
        const scripts = document.querySelectorAll('script[type="text/ryx"]');
        console.log(`RyxScript: Found ${scripts.length} script(s).`);

        for (const script of scripts) {
            try {
                const response = await fetch(script.src);
                if (!response.ok) {
                    throw new Error(`Failed to load script: ${script.src}`);
                }
                const ryxCode = await response.text();
                console.log(`--- Transpiling ${script.src} ---`);
                
                const jsCode = transpile(ryxCode);
                console.log("--- Transpiled JS (for debugging) ---\n", jsCode);
                
                new Function(jsCode)();

            } catch (error) {
                console.error(`Error processing RyxScript file ${script.src}:`, error);
                return;
            }
        }
        
        this._start();
    };

    // ========================================================================
    // 4. AUTO-INITIALIZE
    // ========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        Ryx._init();
    });

})();
