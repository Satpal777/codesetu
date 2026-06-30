"use client";
import React, { useId } from "react";
import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import type { Container, Engine } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";
import { motion, useAnimation } from "motion/react";

export const SparklesCore = (props: {
  id?: string;
  className?: string;
  background?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
  direction?: "top" | "bottom" | "left" | "right" | "none";
}) => {
  const {
    id,
    className,
    background,
    minSize,
    maxSize,
    speed,
    particleColor,
    particleDensity,
    direction = "none",
  } = props;
  const [init, setInit] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);
  const controls = useAnimation();

  // Fade the particles in once they've loaded. Running this from an effect
  // (rather than directly in the tsparticles callback) guarantees the motion
  // component has mounted before controls.start() is called.
  useEffect(() => {
    if (loaded) {
      controls.start({
        opacity: 1,
        transition: {
          duration: 1,
        },
      });
    }
  }, [loaded, controls]);

  const particlesLoaded = async (container?: Container) => {
    if (container) {
      setLoaded(true);
    }
  };

  const generatedId = useId();
  return (
    <motion.div animate={controls} className={className} style={{ opacity: 0 }}>
      {init && (
        <Particles
          id={id || generatedId}
          className="h-full w-full"
          particlesLoaded={particlesLoaded}
          options={{
            background: {
              color: {
                value: background || "transparent",
              },
            },
            fullScreen: {
              enable: false,
              zIndex: 1,
            },
            fpsLimit: 120,
            interactivity: {
              events: {
                onClick: {
                  enable: true,
                  mode: "push",
                },
                onHover: {
                  enable: false,
                  mode: "repulse",
                },
                resize: {
                  enable: true,
                  delay: 0.5
                }
              },
              modes: {
                push: {
                  quantity: 4,
                },
                repulse: {
                  distance: 200,
                  duration: 0.4,
                },
              },
            },
            particles: {
              bounce: {
                horizontal: {
                  value: 1,
                },
                vertical: {
                  value: 1,
                },
              },
              collisions: {
                enable: false,
              },
              color: {
                value: particleColor || "#ffffff",
              },
              move: {
                direction: direction,
                enable: true,
                outModes: {
                  default: "out",
                },
                random: false,
                speed: speed || 0.1,
                straight: false,
              },
              number: {
                density: {
                  enable: true,
                  width: 400,
                  height: 400
                },
                value: particleDensity || 120,
              },
              opacity: {
                value: {
                  min: 0.1,
                  max: 1,
                },
                animation: {
                  enable: true,
                  speed: speed || 0.1,
                  sync: false,
                },
              },
              shape: {
                type: "circle",
              },
              size: {
                value: {
                  min: minSize || 1,
                  max: maxSize || 3,
                },
              },
            },
            detectRetina: true,
          }}
        />
      )}
    </motion.div>
  );
};
