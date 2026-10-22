import { useState, useEffect, useRef } from "react";
import { Link } from 'react-router-dom';
import { useAuth } from "./AuthContext.jsx";

import "./Login.css";

export default function Login() {
    const { login, user } = useAuth();

    // all state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    //  background: evidence-constellation canvas 
    // NOTE: colors below are literals (canvas can't read CSS vars) —
    // amber = --c-amber (#f2a93b), paper = --c-paper (#efe6d3) from tokens.css
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const LINK = 132;             // link distance (px)
        let nodes = [];
        let raf = 0;
        let w = 0, h = 0;

        function resize() {
            w = canvas.clientWidth;
            h = canvas.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // density scales with viewport area
            const count = Math.max(26, Math.min(72, Math.round((w * h) / 17000)));
            nodes = Array.from({ length: count }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.22,
                vy: (Math.random() - 0.5) * 0.22,
                r: Math.random() * 1.5 + 0.7,
                phase: Math.random() * Math.PI * 2      // per-node pulse offset
            }));
        }

        function draw(t) {
            ctx.clearRect(0, 0, w, h);

            // connecting "evidence links" between nearby nodes
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const a = nodes[i], b = nodes[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < LINK) {
                        const alpha = (1 - d / LINK) * 0.15;
                        ctx.strokeStyle = `rgba(239, 230, 211, ${alpha})`;
                        ctx.lineWidth = 0.6;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }

            // nodes — amber points that softly pulse
            for (const n of nodes) {
                if (!reduced) {
                    n.x += n.vx;
                    n.y += n.vy;
                    if (n.x < 0 || n.x > w) n.vx *= -1;
                    if (n.y < 0 || n.y > h) n.vy *= -1;
                }
                const glow = 0.5 + 0.5 * Math.sin((t || 0) / 900 + n.phase);
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(242, 169, 59, ${0.22 + glow * 0.5})`;
                ctx.fill();
            }

            if (!reduced) raf = requestAnimationFrame(draw);
        }

        function onResize() {
            resize();
            if (reduced) draw(0);       // redraw one static frame
        }

        resize();
        draw(0);
        window.addEventListener("resize", onResize);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
        };
    }, []);

    // on submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login({ email, password });
        } catch (err) {
            // backend error
            setError(err.response?.data?.error?.message
                || "Login failed "
            )
        } finally {
            setLoading(false);
        }
    }

    if (user) {
        return (
            <main className="login-already">
                <p>Already logged in as <b>{user.name}</b> ({user.role}).</p>
                <Link to="/">Go to dashboard</Link>
            </main>
        )
    }

    return (
        <main className="login">
            {/* -- background layers -- */}
            <div className="login-bg" aria-hidden="true">
                <canvas ref={canvasRef} className="login-canvas" />
                <div className="login-lamp" />
                <div className="login-cool" />
                <div className="login-grain" />
                <div className="login-vignette" />
            </div>

            {/* ghost score watermark — the product's output, haunting the desk */}
            <span className="login-ghost" aria-hidden="true">8.7</span>

            {/* the three evidence types your product is built on, drifting */}
            <div className="login-chips" aria-hidden="true">
                <span className="chip chip--verified"><i />verified evidence</span>
                <span className="chip chip--claim"><i />team claim</span>
                <span className="chip chip--inferred"><i />ai inference</span>
            </div>

            {/* -- card -- */}
            <div className="login-card">
                <span className="login-eyebrow">judge access — secure</span>
                <h1>HackJudge <em>AI</em></h1>
                <h2>Every submission, weighed by evidence — not vibes.</h2>

                <form onSubmit={handleSubmit} className="login-form">
                    <label className="login-field">
                        <span>Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete='email'
                            placeholder="you@example.com"
                        />
                    </label>

                    <label className="login-field">
                        <span>Password</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete='current-password'
                            placeholder="••••••••"
                        />
                    </label>

                    {error && <p role="alert" className="login-error">{error}</p>}

                    <button type='submit' disabled={loading} className="login-submit">
                        {loading ? "Logging in..." : "Enter the judging floor"}
                    </button>
                </form>
            </div>
        </main>
    )
}
