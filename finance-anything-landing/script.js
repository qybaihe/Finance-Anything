/**
 * High-performance Deterministic Canvas Particle Orbit System for Finance Anything
 */

const canvas = document.getElementById('canvas-bg');
const ctx = canvas.getContext('2d');

let width, height;

// Configuration
const config = {
    bgStarCount: 80, // Very restrained background stars, no random flying
    coreX: 0,        // Will be calculated on resize
    coreY: 0,
    orbitRadiusBase: 120, // Base radius for agent orbits
    agentCount: 13,
    colors: {
        bg: '#06080b',
        star: 'rgba(148, 163, 184, 0.15)', // Very dim stars
        core: '#d4af37',
        coreGlow: 'rgba(212, 175, 55, 0.3)',
        agentBase: '#10b981',
        agentPulse: 'rgba(16, 185, 129, 0.6)',
        dataFlow: '#f59e0b', // Amber for data flow
        dataFlowTrail: 'rgba(245, 158, 11, 0.25)'
    }
};

let stars = [];

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    // Core position: center of the right half (aligning with the UI console panel)
    config.coreX = width * 0.75;
    config.coreY = height * 0.5;
    
    initSystem();
}

function initSystem() {
    stars = [];
    for (let i = 0; i < config.bgStarCount; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 1.2 + 0.3,
            speedY: Math.random() * 0.15 + 0.05 // Very slow upward drift
        });
    }
}

// Deterministic Time for stable cycling
let startTime = Date.now();

function drawNetwork() {
    ctx.clearRect(0, 0, width, height);
    
    const time = (Date.now() - startTime) / 1000; // time in seconds

    // 1. Draw Background Stars (Restrained data stream)
    stars.forEach(star => {
        star.y -= star.speedY;
        if (star.y < 0) {
            star.y = height;
            star.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = config.colors.star;
        ctx.fill();
    });
    
    // 2. Draw Stable Orbit Rings
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(config.coreX, config.coreY, config.orbitRadiusBase + r * 65, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 - r * 0.015})`;
        ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // 3. Calculate Agent Positions deterministically based on Time
    const agents = [];
    for (let i = 0; i < config.agentCount; i++) {
        // Distribute agents across 3 orbits (e.g. 4, 4, 5)
        let orbitLayer = i % 3 + 1; 
        const radius = config.orbitRadiusBase + orbitLayer * 65;
        // Outer orbits move slightly slower
        const orbitSpeed = 0.15 / orbitLayer; 
        const baseAngle = (i / config.agentCount) * Math.PI * 2;
        // Clockwise stable orbit
        const angle = baseAngle + time * orbitSpeed; 
        
        const x = config.coreX + Math.cos(angle) * radius;
        const y = config.coreY + Math.sin(angle) * radius;
        
        agents.push({ id: i, x, y, angle, radius, layer: orbitLayer });
    }

    // Sort agents by angle to form a logical sequential cycle in the ring
    // This allows data to flow strictly from node n to node n+1 along the circle
    agents.sort((a, b) => {
        let angleA = ((a.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        let angleB = ((b.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return angleA - angleB;
    });

    // 4. Draw Data Pulses (The clear "cycle" feeling)
    // The pulse travels consecutively through the sorted agents
    const pulseCycleSpeed = 1.8; // Nodes per second
    const currentPulseFloat = (time * pulseCycleSpeed) % config.agentCount;
    const pulseIndex = Math.floor(currentPulseFloat);
    const pulseProgress = currentPulseFloat - pulseIndex;
    
    const sourceAgent = agents[pulseIndex];
    const targetAgent = agents[(pulseIndex + 1) % config.agentCount];
    
    if (sourceAgent && targetAgent) {
        const px = sourceAgent.x + (targetAgent.x - sourceAgent.x) * pulseProgress;
        const py = sourceAgent.y + (targetAgent.y - sourceAgent.y) * pulseProgress;
        
        // Trail line between current cycling nodes
        ctx.beginPath();
        ctx.moveTo(sourceAgent.x, sourceAgent.y);
        ctx.lineTo(targetAgent.x, targetAgent.y);
        ctx.strokeStyle = config.colors.dataFlowTrail;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Data packet pulse
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = config.colors.dataFlow;
        ctx.shadowBlur = 12;
        ctx.shadowColor = config.colors.dataFlow;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    
    // Core to Agent data fetch pulse
    const corePulseProgress = (time * 1.5) % 1; 
    // Pulse to a node roughly 1/3 across the cycle to show concurrency
    const coreTargetAgent = agents[Math.floor(config.agentCount / 3)]; 
    if (coreTargetAgent) {
        const cpx = config.coreX + (coreTargetAgent.x - config.coreX) * corePulseProgress;
        const cpy = config.coreY + (coreTargetAgent.y - config.coreY) * corePulseProgress;
        
        ctx.beginPath();
        ctx.moveTo(config.coreX, config.coreY);
        ctx.lineTo(coreTargetAgent.x, coreTargetAgent.y);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(cpx, cpy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = config.colors.core;
        ctx.shadowBlur = 10;
        ctx.shadowColor = config.colors.core;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // 5. Draw Agents
    agents.forEach((agent, index) => {
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, 4, 0, Math.PI * 2);
        
        // Highlight agents that are actively transferring data
        if (index === pulseIndex || index === (pulseIndex + 1) % config.agentCount) {
            ctx.fillStyle = config.colors.agentBase;
            ctx.shadowBlur = 15;
            ctx.shadowColor = config.colors.agentPulse;
            ctx.fill();
            
            // Active outline
            ctx.beginPath();
            ctx.arc(agent.x, agent.y, 9, 0, Math.PI * 2);
            ctx.strokeStyle = config.colors.agentPulse;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.35)'; // Dimmer for inactive
            ctx.shadowBlur = 0;
            ctx.fill();
        }
    });
    
    // 6. Draw Finance Anything core
    const coreScale = 1 + Math.sin(time * 2.5) * 0.04; // Gentle breathing
    
    // Core Glow Aura
    ctx.beginPath();
    const gradient = ctx.createRadialGradient(
        config.coreX, config.coreY, 10 * coreScale, 
        config.coreX, config.coreY, 160 * coreScale
    );
    gradient.addColorStop(0, config.colors.coreGlow);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.arc(config.coreX, config.coreY, 160 * coreScale, 0, Math.PI * 2);
    ctx.fill();

    // Solid Central Core
    ctx.beginPath();
    ctx.arc(config.coreX, config.coreY, 7 * coreScale, 0, Math.PI * 2);
    ctx.fillStyle = config.colors.core;
    ctx.shadowBlur = 25;
    ctx.shadowColor = config.colors.core;
    ctx.fill();
    ctx.shadowBlur = 0;

    requestAnimationFrame(drawNetwork);
}

// Event Listeners
window.addEventListener('resize', resize);

// Scroll Reveal Logic
function handleScrollReveal() {
    const reveals = document.querySelectorAll('.section-header');
    
    reveals.forEach(element => {
        const windowHeight = window.innerHeight;
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 100;
        
        if (elementTop < windowHeight - elementVisible) {
            element.style.animation = 'fadeUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards';
            element.style.opacity = '1';
        }
    });
}

window.addEventListener('scroll', handleScrollReveal);

const handoffSteps = [
    {
        node: 0,
        label: 'Cycle 01 · 任务拆解',
        lines: [
            { type: 'success', tag: '[CORE]', text: 'Finance Anything 收到支付决策目标' },
            { type: '', tag: '[PLAN]', text: '决策总规划师拆解约束、目标和关键假设' },
            { type: 'highlight', tag: '[DELEGATE]', text: '委派任务 → 信息采集 Agent / 用户画像 Agent' },
            { type: '', tag: '[SCOPE]', text: '锁定预算、时间窗口、风险偏好与退出条件' },
            { type: '', tag: '[QUEUE]', text: '等待多源证据包回传...' },
            { type: '', tag: '[TRACE]', text: '建立本轮 Agent 任务链路与回传通道' },
            { type: 'success', tag: '[SYNC]', text: 'Finance Anything 建立本轮循环上下文' },
        ],
    },
    {
        node: 1,
        label: 'Cycle 02 · 证据采集',
        lines: [
            { type: '', tag: '[AGENT]', text: '信息采集 Agent 抓取价格、评论、财报与市场信号' },
            { type: 'highlight', tag: '[RESULT]', text: '采集结果回传 → 证据可信度 Agent' },
            { type: '', tag: '[VERIFY]', text: '可信度 Agent 正在交叉验证来源与时间戳' },
            { type: '', tag: '[FILTER]', text: '过滤过期数据、营销噪音和低可信样本' },
            { type: 'success', tag: '[CACHE]', text: '有效证据包已写入共享决策上下文' },
            { type: '', tag: '[HANDOFF]', text: '证据摘要同步给股票专项 / 商品专项 Agent' },
            { type: '', tag: '[NEXT]', text: '委派下一步 → 成本与收益 Agent' },
        ],
    },
    {
        node: 2,
        label: 'Cycle 03 · 价值测算',
        lines: [
            { type: 'highlight', tag: '[AGENT]', text: '二手价值 Agent 计算保值率、折旧曲线和转售流动性' },
            { type: '', tag: '[AGENT]', text: '成本与收益 Agent 合并预算、机会成本和长期收益' },
            { type: 'success', tag: '[RESULT]', text: '价值测算回传 → 风险 Agent / 场景模拟 Agent' },
            { type: '', tag: '[MODEL]', text: '替代方案 Agent 补充同价位与低风险选项' },
            { type: '', tag: '[SIM]', text: '场景模拟 Agent 生成乐观、基准、悲观三组结果' },
            { type: '', tag: '[SCORE]', text: '计算综合收益、保值率、流动性与执行难度' },
            { type: '', tag: '[NEXT]', text: '委派下一步 → 反方辩论 Agent' },
        ],
    },
    {
        node: 3,
        label: 'Cycle 04 · 反方挑战',
        lines: [
            { type: 'warning', tag: '[AGENT]', text: '反方辩论 Agent 挑战当前结论：寻找反证和遗漏风险' },
            { type: '', tag: '[RISK]', text: '风险 Agent 标记黑天鹅、流动性和执行失败点' },
            { type: 'highlight', tag: '[RESULT]', text: '挑战结果回传 → 决策总规划师' },
            { type: '', tag: '[CHECK]', text: '核对关键假设是否被单一证据过度支撑' },
            { type: '', tag: '[REVISE]', text: '核心结论被重新加权，低可信证据降级' },
            { type: 'warning', tag: '[ALERT]', text: '高风险路径已标记，需要最终报告显式提示' },
            { type: 'success', tag: '[NEXT]', text: '委派下一步 → 决策报告 Agent' },
        ],
    },
    {
        node: 4,
        label: 'Cycle 05 · 报告回传',
        lines: [
            { type: 'success', tag: '[REPORT]', text: '决策报告 Agent 汇总所有 Agent 的证据与争议点' },
            { type: '', tag: '[OUTPUT]', text: '生成 Buy / Wait / Avoid 建议和执行清单' },
            { type: 'highlight', tag: '[RETURN]', text: '最终决策报告回传 → Finance Anything' },
            { type: '', tag: '[AUDIT]', text: '保留证据链、反方意见和关键假设用于复盘' },
            { type: '', tag: '[BROADCAST]', text: '核心结论广播给其他 Agent，准备下一轮复核' },
            { type: '', tag: '[READY]', text: '等待用户追问、补充约束或发起新一轮决策' },
            { type: 'success', tag: '[LOOP]', text: '循环完成，即将进入下一次委派' },
        ],
    },
];

function startTerminalHandoffLoop() {
    const nodes = Array.from(document.querySelectorAll('[data-flow-node]'));
    const terminalLines = document.querySelector('[data-terminal-lines]');
    const loopLabel = document.querySelector('[data-loop-label]');
    const beam = document.querySelector('[data-handoff-beam]');

    if (!nodes.length || !terminalLines || !loopLabel || !beam) return;

    const lineDelayMs = 600;
    const stageDelayMs = 6200;
    let stepIndex = 0;
    let lineTimers = [];

    const escapeText = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderStep = () => {
        const step = handoffSteps[stepIndex % handoffSteps.length];

        lineTimers.forEach((timer) => window.clearTimeout(timer));
        lineTimers = [];

        nodes.forEach((node, index) => {
            node.classList.toggle('active', index === step.node);
        });

        beam.style.transform = `translateX(${step.node * 112}%)`;
        loopLabel.textContent = step.label;

        step.lines.forEach((line, index) => {
            const timer = window.setTimeout(() => {
                const className = ['line', line.type, index === 0 ? 'is-new' : ''].filter(Boolean).join(' ');
                const lineNode = document.createElement('div');
                lineNode.className = className;
                lineNode.innerHTML = `<span>${escapeText(line.tag)}</span> ${escapeText(line.text)}`;
                terminalLines.appendChild(lineNode);
                while (terminalLines.children.length > 7) {
                    terminalLines.removeChild(terminalLines.firstElementChild);
                }
                terminalLines.scrollTop = terminalLines.scrollHeight;
            }, index * lineDelayMs);
            lineTimers.push(timer);
        });

        stepIndex += 1;
    };

    renderStep();
    window.setInterval(renderStep, stageDelayMs);
}

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    resize();
    drawNetwork();
    startTerminalHandoffLoop();
    
    setTimeout(handleScrollReveal, 400);
});
