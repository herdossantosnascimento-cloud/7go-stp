"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

export function MobileHeaderMenu() {
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="mobile-header-menu">
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      {open && (
        <div className="mobile-menu-panel">
          <nav>
            <a href="/" onClick={closeMenu}>
              Início
            </a>

            <a href="/#frota" onClick={closeMenu}>
              Carros
            </a>

            <a href="/como-funciona" onClick={closeMenu}>
              Como funciona
            </a>

            <a href="/minha-reserva" onClick={closeMenu}>
              Minha reserva
            </a>

            <a href="/#contacto" onClick={closeMenu}>
              Contacto
            </a>
          </nav>
        </div>
      )}
    </div>
  );
}
