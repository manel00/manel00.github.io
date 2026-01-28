// Farm Pig Shooter - Third Person Shooting Game
// Using Three.js for 3D rendering

const CONFIG = {
    spawnRate: 2000,
    pigSpeed: 0.03,
    bulletSpeed: 0.8,
    colors: {
        sky: 0x87CEEB,
        grass: 0x4CAF50,
        dirt: 0x8B4513,
        pig: 0xFFB6C1,
        fence: 0x8B5A2B,
        barn: 0xB22222
    }
};

let scene, camera, renderer, player;
let pigs = [];
let bullets = [];
let score = 0;
let gameActive = true;
let scoreElement, crosshair;
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let container;

function init() {
    container = document.getElementById('game-container');
    if (!container) return;

    // Create Score Overlay
    scoreElement = document.createElement('div');
    scoreElement.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        color: #ccff00;
        font-family: 'JetBrains Mono', monospace;
        font-size: 14px;
        z-index: 10;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    `;
    scoreElement.innerHTML = 'PIGS_DOWN: 0';
    container.appendChild(scoreElement);

    // Create Crosshair (follows mouse)
    crosshair = document.createElement('div');
    crosshair.style.cssText = `
        position: absolute;
        width: 30px;
        height: 30px;
        pointer-events: none;
        z-index: 10;
        transform: translate(-50%, -50%);
    `;
    crosshair.innerHTML = `
        <svg width="30" height="30" viewBox="0 0 30 30">
            <circle cx="15" cy="15" r="10" stroke="#ccff00" stroke-width="2" fill="none"/>
            <circle cx="15" cy="15" r="2" fill="#ccff00"/>
            <line x1="15" y1="0" x2="15" y2="8" stroke="#ccff00" stroke-width="2"/>
            <line x1="15" y1="22" x2="15" y2="30" stroke="#ccff00" stroke-width="2"/>
            <line x1="0" y1="15" x2="8" y2="15" stroke="#ccff00" stroke-width="2"/>
            <line x1="22" y1="15" x2="30" y2="15" stroke="#ccff00" stroke-width="2"/>
        </svg>
    `;
    container.appendChild(crosshair);

    // Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.sky);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.02);

    // Camera (Third Person View)
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 2, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Create Farm Environment
    createFarm();

    // Create Player (Farmer with gun)
    createPlayer();

    // Mouse move - crosshair follows cursor
    container.addEventListener('mousemove', onMouseMove);

    // Click to shoot
    container.addEventListener('click', shoot);

    // Handle Resize
    window.addEventListener('resize', () => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });

    animate();
    setInterval(spawnPig, CONFIG.spawnRate);
}

function onMouseMove(event) {
    const rect = container.getBoundingClientRect();

    // Update crosshair position
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    crosshair.style.left = x + 'px';
    crosshair.style.top = y + 'px';

    // Update normalized mouse coordinates for raycasting
    mouse.x = (x / rect.width) * 2 - 1;
    mouse.y = -(y / rect.height) * 2 + 1;
}

function createFarm() {
    // Ground - Green Grass
    const grassGeometry = new THREE.PlaneGeometry(100, 100);
    const grassMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.colors.grass });
    const grass = new THREE.Mesh(grassGeometry, grassMaterial);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    scene.add(grass);

    // Add some grass texture variation
    for (let i = 0; i < 50; i++) {
        const tuftGeometry = new THREE.ConeGeometry(0.1, 0.3, 4);
        const tuftMaterial = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHSL(0.3, 0.6, 0.3 + Math.random() * 0.2)
        });
        const tuft = new THREE.Mesh(tuftGeometry, tuftMaterial);
        tuft.position.set(
            (Math.random() - 0.5) * 30,
            0.15,
            (Math.random() - 0.5) * 20
        );
        scene.add(tuft);
    }

    // Fence Posts
    const fenceGeometry = new THREE.BoxGeometry(0.2, 1.5, 0.2);
    const fenceMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.colors.fence });

    for (let x = -15; x <= 15; x += 3) {
        const post = new THREE.Mesh(fenceGeometry, fenceMaterial);
        post.position.set(x, 0.75, -8);
        post.castShadow = true;
        scene.add(post);

        // Horizontal rails
        const railGeometry = new THREE.BoxGeometry(3, 0.1, 0.1);
        const rail1 = new THREE.Mesh(railGeometry, fenceMaterial);
        rail1.position.set(x + 1.5, 0.5, -8);
        scene.add(rail1);

        const rail2 = new THREE.Mesh(railGeometry, fenceMaterial);
        rail2.position.set(x + 1.5, 1, -8);
        scene.add(rail2);
    }

    // Simple Barn (background)
    const barnGroup = new THREE.Group();

    // Barn body
    const barnBodyGeometry = new THREE.BoxGeometry(8, 5, 6);
    const barnMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.colors.barn });
    const barnBody = new THREE.Mesh(barnBodyGeometry, barnMaterial);
    barnBody.position.y = 2.5;
    barnBody.castShadow = true;
    barnGroup.add(barnBody);

    // Barn roof
    const roofGeometry = new THREE.ConeGeometry(6, 3, 4);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 6.5;
    roof.rotation.y = Math.PI / 4;
    barnGroup.add(roof);

    // Barn door
    const doorGeometry = new THREE.BoxGeometry(2, 3, 0.1);
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x5D4037 });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, 1.5, 3.05);
    barnGroup.add(door);

    barnGroup.position.set(0, 0, -20);
    scene.add(barnGroup);

    // Hay bales
    const hayGeometry = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 8);
    const hayMaterial = new THREE.MeshLambertMaterial({ color: 0xDAA520 });

    for (let i = 0; i < 5; i++) {
        const hay = new THREE.Mesh(hayGeometry, hayMaterial);
        hay.rotation.z = Math.PI / 2;
        hay.position.set(-12 + i * 2, 0.75, -5);
        hay.castShadow = true;
        scene.add(hay);
    }

    // Sun
    const sunGeometry = new THREE.SphereGeometry(2, 16, 16);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(20, 25, -30);
    scene.add(sun);

    // Clouds
    for (let i = 0; i < 5; i++) {
        createCloud(
            (Math.random() - 0.5) * 40,
            15 + Math.random() * 5,
            -15 - Math.random() * 10
        );
    }
}

function createCloud(x, y, z) {
    const cloudGroup = new THREE.Group();
    const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

    for (let i = 0; i < 5; i++) {
        const puffGeometry = new THREE.SphereGeometry(1 + Math.random(), 8, 8);
        const puff = new THREE.Mesh(puffGeometry, cloudMaterial);
        puff.position.set(i * 0.8, Math.random() * 0.5, Math.random() * 0.5);
        cloudGroup.add(puff);
    }

    cloudGroup.position.set(x, y, z);
    scene.add(cloudGroup);
}

function createPlayer() {
    // Simple farmer representation (third person view)
    player = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.BoxGeometry(1, 1.5, 0.5);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x2196F3 }); // Blue shirt
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.25;
    player.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDBAC });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.3;
    player.add(head);

    // Hat
    const hatBrimGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16);
    const hatMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const hatBrim = new THREE.Mesh(hatBrimGeometry, hatMaterial);
    hatBrim.position.y = 2.6;
    player.add(hatBrim);

    const hatTopGeometry = new THREE.CylinderGeometry(0.3, 0.35, 0.3, 16);
    const hatTop = new THREE.Mesh(hatTopGeometry, hatMaterial);
    hatTop.position.y = 2.75;
    player.add(hatTop);

    // Gun (simple rifle shape)
    const gunGroup = new THREE.Group();
    const gunBarrelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8);
    const gunMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const gunBarrel = new THREE.Mesh(gunBarrelGeometry, gunMaterial);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.z = 0.75;
    gunGroup.add(gunBarrel);

    const gunStockGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.4);
    const gunStock = new THREE.Mesh(gunStockGeometry, new THREE.MeshLambertMaterial({ color: 0x5D4037 }));
    gunStock.position.z = -0.1;
    gunGroup.add(gunStock);

    gunGroup.position.set(0.6, 1.3, 0.3);
    gunGroup.name = 'gun';
    player.add(gunGroup);

    player.position.set(0, 0, 8);
    player.castShadow = true;
    scene.add(player);
}

function createPig() {
    const pigGroup = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.SphereGeometry(0.6, 16, 12);
    bodyGeometry.scale(1.3, 1, 1);
    const pigMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.colors.pig });
    const body = new THREE.Mesh(bodyGeometry, pigMaterial);
    body.position.y = 0.6;
    body.castShadow = true;
    pigGroup.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.35, 12, 12);
    const head = new THREE.Mesh(headGeometry, pigMaterial);
    head.position.set(0.7, 0.7, 0);
    head.castShadow = true;
    pigGroup.add(head);

    // Snout
    const snoutGeometry = new THREE.CylinderGeometry(0.15, 0.18, 0.2, 12);
    const snout = new THREE.Mesh(snoutGeometry, pigMaterial);
    snout.rotation.z = Math.PI / 2;
    snout.position.set(1, 0.65, 0);
    pigGroup.add(snout);

    // Nostrils
    const nostrilMaterial = new THREE.MeshBasicMaterial({ color: 0xFF69B4 });
    const nostrilGeometry = new THREE.CircleGeometry(0.03, 8);
    const nostril1 = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
    nostril1.position.set(1.11, 0.68, 0.05);
    nostril1.rotation.y = Math.PI / 2;
    pigGroup.add(nostril1);

    const nostril2 = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
    nostril2.position.set(1.11, 0.68, -0.05);
    nostril2.rotation.y = Math.PI / 2;
    pigGroup.add(nostril2);

    // Eyes
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const eye1 = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye1.position.set(0.9, 0.85, 0.2);
    pigGroup.add(eye1);

    const eye2 = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye2.position.set(0.9, 0.85, -0.2);
    pigGroup.add(eye2);

    // Ears
    const earGeometry = new THREE.ConeGeometry(0.12, 0.2, 4);
    const ear1 = new THREE.Mesh(earGeometry, pigMaterial);
    ear1.position.set(0.5, 1, 0.2);
    ear1.rotation.z = 0.3;
    ear1.rotation.x = -0.3;
    pigGroup.add(ear1);

    const ear2 = new THREE.Mesh(earGeometry, pigMaterial);
    ear2.position.set(0.5, 1, -0.2);
    ear2.rotation.z = 0.3;
    ear2.rotation.x = 0.3;
    pigGroup.add(ear2);

    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.4, 8);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0xFFB6C1 });

    const legPositions = [
        [-0.4, 0.2, 0.25],
        [-0.4, 0.2, -0.25],
        [0.3, 0.2, 0.25],
        [0.3, 0.2, -0.25]
    ];

    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(...pos);
        pigGroup.add(leg);
    });

    // Curly tail
    const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.8, 0.6, 0),
        new THREE.Vector3(-0.9, 0.7, 0.1),
        new THREE.Vector3(-0.85, 0.8, 0),
        new THREE.Vector3(-0.95, 0.75, -0.1)
    ]);
    const tailGeometry = new THREE.TubeGeometry(tailCurve, 8, 0.03, 6, false);
    const tail = new THREE.Mesh(tailGeometry, pigMaterial);
    pigGroup.add(tail);

    // Mark as pig for raycasting
    pigGroup.userData.isPig = true;

    return pigGroup;
}

function spawnPig() {
    if (!gameActive) return;

    const pig = createPig();

    // Random position in the farm area
    const side = Math.random() > 0.5 ? 1 : -1;
    pig.position.set(
        side * (10 + Math.random() * 5),
        0,
        (Math.random() - 0.5) * 10 - 5
    );

    // Face toward center
    pig.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

    // Add velocity
    pig.userData = {
        ...pig.userData,
        velocity: new THREE.Vector3(-side * CONFIG.pigSpeed, 0, (Math.random() - 0.5) * 0.01),
        wobble: Math.random() * Math.PI * 2
    };

    scene.add(pig);
    pigs.push(pig);

    // Max pigs limit
    if (pigs.length > 10) {
        const oldPig = pigs.shift();
        scene.remove(oldPig);
    }
}

function shoot(event) {
    const rect = container.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / rect.width * 2 - 1;
    const clickY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Use raycaster to find where in 3D space the click points to
    raycaster.setFromCamera(new THREE.Vector2(clickX, clickY), camera);

    // Check if we clicked on a pig directly
    const pigMeshes = [];
    pigs.forEach(pig => {
        pig.traverse(child => {
            if (child.isMesh) pigMeshes.push(child);
        });
    });

    const intersects = raycaster.intersectObjects(pigMeshes, false);

    if (intersects.length > 0) {
        // Direct hit on pig!
        let hitPig = intersects[0].object;
        // Find the parent pig group
        while (hitPig.parent && !hitPig.userData.isPig) {
            hitPig = hitPig.parent;
        }

        if (hitPig.userData.isPig) {
            // Remove pig immediately
            scene.remove(hitPig);
            pigs = pigs.filter(p => p !== hitPig);
            score++;
            scoreElement.innerHTML = `PIGS_DOWN: ${score}`;
            createHitEffect(hitPig.position);
        }
    }

    // Create bullet that travels toward click point
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Start from player's gun position
    const gunWorldPos = new THREE.Vector3();
    player.getObjectByName('gun').getWorldPosition(gunWorldPos);
    bullet.position.copy(gunWorldPos);

    // Calculate direction toward where we clicked in 3D space
    const targetPoint = new THREE.Vector3();
    raycaster.ray.at(20, targetPoint); // Get point 20 units along ray

    const direction = new THREE.Vector3()
        .subVectors(targetPoint, bullet.position)
        .normalize()
        .multiplyScalar(CONFIG.bulletSpeed);

    bullet.userData = {
        velocity: direction
    };

    scene.add(bullet);
    bullets.push(bullet);

    // Muzzle flash effect
    const flashGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00, transparent: true, opacity: 0.8 });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(gunWorldPos);
    flash.position.z -= 0.5;
    scene.add(flash);

    setTimeout(() => scene.remove(flash), 50);
}

function checkCollisions() {
    bullets.forEach((bullet, bulletIndex) => {
        pigs.forEach((pig, pigIndex) => {
            const distance = bullet.position.distanceTo(pig.position.clone().add(new THREE.Vector3(0, 0.6, 0)));

            if (distance < 1.2) {
                // Hit!
                scene.remove(bullet);
                scene.remove(pig);
                bullets.splice(bulletIndex, 1);
                pigs.splice(pigIndex, 1);

                score++;
                scoreElement.innerHTML = `PIGS_DOWN: ${score}`;

                // Create hit particles
                createHitEffect(pig.position);
            }
        });
    });
}

function createHitEffect(position) {
    for (let i = 0; i < 10; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0xFFB6C1 : 0xFFFFFF
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);
        particle.position.y += 0.6;

        particle.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                Math.random() * 0.2,
                (Math.random() - 0.5) * 0.2
            ),
            life: 30
        };

        scene.add(particle);

        // Animate and remove
        const animateParticle = () => {
            particle.position.add(particle.userData.velocity);
            particle.userData.velocity.y -= 0.01; // Gravity
            particle.userData.life--;

            if (particle.userData.life > 0) {
                requestAnimationFrame(animateParticle);
            } else {
                scene.remove(particle);
            }
        };
        animateParticle();
    }
}

function animate() {
    requestAnimationFrame(animate);

    // Update pigs
    pigs.forEach(pig => {
        pig.position.add(pig.userData.velocity);

        // Wobble animation (walking effect)
        pig.userData.wobble += 0.1;
        pig.position.y = Math.abs(Math.sin(pig.userData.wobble)) * 0.1;

        // Bounce off boundaries
        if (Math.abs(pig.position.x) > 15) {
            pig.userData.velocity.x *= -1;
            pig.rotation.y += Math.PI;
        }
        if (pig.position.z > 5 || pig.position.z < -10) {
            pig.userData.velocity.z *= -1;
        }
    });

    // Update bullets
    bullets = bullets.filter(bullet => {
        bullet.position.add(bullet.userData.velocity);

        // Remove if out of bounds
        if (bullet.position.z < -30 || bullet.position.y < -5 || bullet.position.y > 30) {
            scene.remove(bullet);
            return false;
        }
        return true;
    });

    // Check collisions
    checkCollisions();

    renderer.render(scene, camera);
}

// Start Game
init();
