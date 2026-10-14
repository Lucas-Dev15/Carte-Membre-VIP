"use client";

import { useEffect, useRef, useState } from "react";
import { BOLT_PATH, BoltIcon } from "./Logo";
import styles from "./MemberCard.module.css";

export interface MemberCardProps {
  name: string;
  city: string;
  code: string;
  volts: number;
  levelShort: string; // « Niv. 3 Explorateur »
  memberSince: string; // « mars 2026 »
  qrSvg: string; // SVG généré côté serveur (contenu de confiance)
}

export function MemberCard(props: MemberCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltEnabled, setTiltEnabled] = useState(false);

  useEffect(() => {
    // Inclinaison seulement avec une souris, et jamais si l'utilisateur limite les animations.
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => setTiltEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el || !tiltEnabled) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.transform = `rotateX(${(0.5 - y) * 16}deg) rotateY(${(x - 0.5) * 22}deg) scale(1.03)`;
    el.dataset.active = "true";
  }

  function onLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "";
    delete el.dataset.active;
  }

  return (
    <div className={styles.scene}>
      <div className={styles.float}>
        <div
          ref={cardRef}
          className={styles.card}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          role="img"
          aria-label={`Carte membre Les RDV IA de ${props.name}, ${props.city}, code ${props.code}`}
        >
          <div className={styles.dots} />
          <svg className={styles.bolt} viewBox="0 0 24 24" aria-hidden="true">
            <path d={BOLT_PATH} fill="#F9B233" />
          </svg>
          <div className={styles.sheen} />
          <div className={styles.glare} />

          <div className={styles.content}>
            <div className={styles.top}>
              <div className={styles.brand}>
                <BoltIcon size={24} />
                <span>Les rendez-vous IA</span>
              </div>
              <span className={styles.city}>{props.city}</span>
            </div>

            <div className={styles.bottom}>
              <div className={styles.identity}>
                <span className={styles.voltsPill}>
                  ⚡ {props.volts} volts · {props.levelShort}
                </span>
                <span className={styles.name}>{props.name}</span>
                <span className={styles.since}>Membre depuis {props.memberSince}</span>
                <span className={styles.code}>{props.code}</span>
              </div>
              <div className={styles.qr} dangerouslySetInnerHTML={{ __html: props.qrSvg }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
