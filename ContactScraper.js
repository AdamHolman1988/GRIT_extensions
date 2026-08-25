// ==UserScript==
// @name         Dynamics Contact Form Asistent
// @namespace    grit
// @version      1.2
// @description  Ctrl+V => automatické vyplnění kontaktu
// @author       HLM + GPT 5.6
// @match        https://grit.crm4.dynamics.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    console.log('TAMPERMONKEY OK');
})();

(function () {
    'use strict';

    if (window.top !== window.self) {
        return;
    }

    const CRM_FIELDS = {
        firstName: 'firstname.fieldControl-text-box-text',
        lastName: 'lastname.fieldControl-text-box-text',
        jobTitle: 'jobtitle.fieldControl-text-box-text',

        email: 'emailaddress1.fieldControl-mail-text-input',
        mobile: 'mobilephone.fieldControl-phone-text-input',
        phone: 'telephone1.fieldControl-phone-text-input',

        note: 'description.fieldControl-text-box-text',

        street: 'address1_line1.fieldControl-text-box-text',
        city: 'address1_city.fieldControl-text-box-text',
        zip: 'address1_postalcode.fieldControl-text-box-text',

        country: 'grit_zeme.fieldControl-LookupResultsDropdown_grit_zeme_textInputBox_with_filter_new',
        region: 'grit_kraj.fieldControl-LookupResultsDropdown_grit_kraj_textInputBox_with_filter_new'
    };

    function getAllDocuments() {
        const docs = [document];

        for (let i = 0; i < docs.length; i++) {
            let frames;

            try {
                frames = docs[i].querySelectorAll('iframe');
            } catch (e) {
                continue;
            }

            frames.forEach(frame => {
                try {
                    const frameDoc = frame.contentDocument;

                    if (frameDoc && !docs.includes(frameDoc)) {
                        docs.push(frameDoc);
                    }
                } catch (e) {
                    // cross-origin iframe, nepřístupné - přeskočit
                }
            });
        }

        return docs;
    }

    function findField(dataId) {
        for (const doc of getAllDocuments()) {
            const el = doc.querySelector(`[data-id="${dataId}"]`);

            if (el) {
                return el;
            }
        }

        return null;
    }

    function setField(dataId, value) {
        if (!value) return;

        const el = findField(dataId);

        if (!el) {
            console.warn("Pole nenalezeno:", dataId);
            return;
        }

        el.focus();

        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
        ).set;

        nativeSetter.call(el, value);

        el.dispatchEvent(new InputEvent('input', {
            bubbles: true
        }));

        el.dispatchEvent(new Event('change', {
            bubbles: true
        }));

        el.blur();

        console.log("Vyplněno:", dataId, value);
    }

    function normalize(text) {
        return text
            .replace(/\r/g, '')
            .replace(/\t/g, ' ')
            .replace(/\u00A0/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function parseContact(text) {

        const result = {};

        text = normalize(text);

        const lines = text
            .split('\n')
            .map(x => x.trim())
            .filter(Boolean);

        // EMAIL

        const emailMatch = text.match(
            /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
        );

        if (emailMatch) {
            result.email = emailMatch[0];
        }

        // TELEFONY

        const phones = text.match(
            /(\+?\d[\d\s()/-]{7,}\d)/g
        );

        if (phones?.length) {

            const mobile =
                phones.find(x =>
                    x.includes('+420') ||
                    x.includes('+421') ||
                    x.match(/\b9\d{2}/)
                );

            if (mobile) {
                result.mobile = mobile;
            }

            result.phone = phones[0];
        }

        // JMÉNO

        if (lines.length > 0) {

            const firstLine = lines[0]
                .replace(/^Ing\.\s*/i, '')
                .replace(/^Mgr\.\s*/i, '')
                .replace(/^Bc\.\s*/i, '')
                .trim();

            const parts = firstLine.split(/\s+/);

            if (parts.length >= 2) {
                result.firstName = parts[0];
                result.lastName = parts.slice(1).join(' ');
            }
        }

        // FUNKCE

        if (lines.length > 1) {
            result.jobTitle = lines[1];
        }

        // FIRMA

        const companyLine = lines.find(x =>
            /(s\.r\.o\.|a\.s\.|spol\.|gmbh|ltd|inc)/i.test(x)
        );

        if (companyLine) {
            result.company = companyLine;
        }

        // ADRESA

        const addressLine = lines.find(x =>
            /\d{3}\s?\d{2}/.test(x)
        );

        if (addressLine) {

            const zipMatch =
                addressLine.match(/(\d{3}\s?\d{2})/);

            if (zipMatch) {
                result.zip = zipMatch[1].replace(/\s/g, '');
            }

            const cityMatch =
                addressLine.match(/\d{3}\s?\d{2}\s+(.+)$/);

            if (cityMatch) {
                result.city = cityMatch[1].trim();
            }

            const idx = lines.indexOf(addressLine);

            if (idx > 0) {
                result.street = lines[idx - 1];
            }
        }

        // SK/CZ heuristika

        if (text.includes('+421')) {
            result.country = 'Slovensko';
        }

        if (text.includes('+420')) {
            result.country = 'Česká republika';
        }

        result.note = text;

        return result;
    }

    function fillForm(contact) {

        setField(
            CRM_FIELDS.firstName,
            contact.firstName
        );

        setField(
            CRM_FIELDS.lastName,
            contact.lastName
        );

        setField(
            CRM_FIELDS.jobTitle,
            contact.jobTitle
        );

        setField(
            CRM_FIELDS.email,
            contact.email
        );

        setField(
            CRM_FIELDS.mobile,
            contact.mobile
        );

        setField(
            CRM_FIELDS.phone,
            contact.phone
        );

        setField(
            CRM_FIELDS.street,
            contact.street
        );

        setField(
            CRM_FIELDS.city,
            contact.city
        );

        setField(
            CRM_FIELDS.zip,
            contact.zip
        );

        setField(
            CRM_FIELDS.note,
            contact.note
        );
    }

    async function handlePaste(e) {

        const html =
            e.clipboardData.getData('text/html');

        const text =
            e.clipboardData.getData('text/plain');

        if (!html && !text)
            return;

        console.log("CRM Autofill paste detected");

        e.preventDefault();

        const source = html || text;

        const temp = document.createElement('div');
        temp.innerHTML = source;

        const plainText =
            temp.innerText || text || source;

        const parsed =
            parseContact(plainText);

        console.log(parsed);

        fillForm(parsed);
    }

    const instrumentedDocs = new WeakSet();

    function attachPasteListeners() {
        for (const doc of getAllDocuments()) {
            if (instrumentedDocs.has(doc)) {
                continue;
            }

            instrumentedDocs.add(doc);
            doc.addEventListener('paste', handlePaste, true);
        }
    }

    function createPasteButton() {

        if (!document.body) {
            return;
        }

        if (document.getElementById('grit-contact-paste-btn')) {
            return;
        }

        const btn = document.createElement('button');

        btn.id = 'grit-contact-paste-btn';
        btn.innerHTML = '📋 Vložit kontakt';

        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            padding: '10px 14px',
            background: '#0078d4',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,.3)'
        });

        btn.style.setProperty('z-index', '2147483647', 'important');

        console.log('grit-contact-paste-btn: vytvořeno');

        btn.addEventListener('click', async () => {

            try {
                const text = await navigator.clipboard.readText();

                if (!text) {
                    alert('Ve schránce není text');
                    return;
                }

                console.log('Clipboard text:', text);

                const parsed = parseContact(text);

                console.log(parsed);

                fillForm(parsed);

            } catch (err) {
                console.error(err);
                alert('Browser nedovolil přístup ke schránce');
            }
        });

        document.body.appendChild(btn);
    }

    createPasteButton();
    attachPasteListeners();

    setInterval(() => {
        createPasteButton();
        attachPasteListeners();
    }, 1000);

})();
