// ==UserScript==
// @name         Jira Validator - Agresivní červená
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Obarví prázdná pole a pole s chybou (žlutý vykřičník) na červeno
// @author       HLM a AI
// @match        https://*.atlassian.net/*
// @grant        none
// ==/UserScript==

/* jshint esversion: 6 */

(function() {
    'use strict';

    // Seznam polí - lze pomocí inspect rozšířit a zapsat je to v parent DOV
    const REQUIRED_IDS = [
        'customfield_11849', 'customfield_11783', 'customfield_12923',
        'customfield_10362', 'customfield_10053', 'customfield_10145',
        'customfield_11378', 'customfield_10063', 'customfield_10061',
        'timeoriginalestimate', 'customfield_10144', 'customfield_10361',
        'customfield_10273', 'customfield_10369', 'customfield_10043',
        'customfield_10058', 'customfield_11586',
    ];

    // Funkce pro nastavení barvy
    const setErrorStyle = (el) => {
        if (!el) return;
        el.style.setProperty('border', '2px solid #ff5252', 'important');
        el.style.setProperty('background-color', 'rgba(255, 82, 82, 0.15)', 'important');
        el.style.setProperty('border-radius', '4px', 'important');
    };

    const removeErrorStyle = (el) => {
        if (!el) return;
        el.style.removeProperty('border');
        el.style.removeProperty('background-color');
    };

    // Pomocná funkce pro zjištění, zda text znamená "prázdné pole"
    const isFieldEmpty = (text) => {
        const trimmed = text.trim();
        return trimmed === "" ||
               trimmed.includes("None") ||
               trimmed.includes("Přidat") ||
               trimmed.includes("Add text") ||
               trimmed.includes("0h") ||
               trimmed.includes("Add option");
    };

    const validate = () => {
        // 1. KONTROLA PODLE ID (Hledá texty jako "None", "Add", "Přidat" atp.)
        REQUIRED_IDS.forEach(id => {
            const field = document.querySelector(`[data-testid*="${id}"]`);
            if (field) {
                const text = field.innerText || "";
                if (isFieldEmpty(text)) {
                    const wrapper = field.closest('[data-component-selector="jira-issue-field-heading-field-wrapper"]') || field;
                    setErrorStyle(wrapper);
                } else {
                    const wrapper = field.closest('[data-component-selector="jira-issue-field-heading-field-wrapper"]') || field;
                    if (!wrapper.querySelector('[data-testid="issue-field-error-icon"]')) {
                        removeErrorStyle(wrapper);
                    }
                }
            }
        });

        // 2. NOVÉ: KONTROLA POLE "Popis pro zákazníka" PODLE TEXTU NADPISU
        // Najde h2 element s přesným textem nadpisu
        const headings = document.querySelectorAll('h2[data-component-selector="jira-issue-field-heading-multiline-field-heading-title"]');
        headings.forEach(h2 => {
            if (h2.textContent.trim() === "Popis pro zákazníka") {
                // Najde hlavní div pro toto pole
                const mainWrapper = h2.closest('div._16jlkb7n, div'); 
                // Najde kontejner, co drží jak nadpis, tak hodnotu
                const fieldWrapper = h2.closest('div._1bsb1osq') || h2.parentElement;

                if (fieldWrapper) {
                    // Najde v tomto bloku element, kde je schovaná hodnota "None"
                    const valueSpan = fieldWrapper.querySelector('span._19pkidpf, [role="presentation"] span');
                    const text = valueSpan ? (valueSpan.innerText || "") : fieldWrapper.innerText || "";
                    
                    if (isFieldEmpty(text)) {
                        setErrorStyle(fieldWrapper);
                    } else {
                        removeErrorStyle(fieldWrapper);
                    }
                }
            }
        });

        // 3. KONTROLA JIRA CHYB (Jakmile Jira ukáže chybu, highlitovat pole)
        const jiraErrorIcons = document.querySelectorAll('[data-testid="issue-field-error-icon"]');
        jiraErrorIcons.forEach(icon => {
            const wrapper = icon.closest('[data-component-selector="jira-issue-field-heading-field-wrapper"]');
            if (wrapper) setErrorStyle(wrapper);
        });
    };

    // Jira je dynamická (načítá věci postupně), hlídat čas
    const observer = new MutationObserver(() => validate());
    observer.observe(document.body, { childList: true, subtree: true });

    // Pojistka pro první načtení
    setTimeout(validate, 2000);
})();
