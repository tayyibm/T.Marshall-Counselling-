/*
 * T.Marshall Counselling – site behaviour
 * =======================================
 * One file, no libraries, loaded with "defer" from index.html.
 *
 * Everything is wired up with addEventListener on element ids or data-* hooks. The page has no
 * inline event-handler attributes, because the server's security policy blocks them.
 * Every element is looked up and checked before it is used, so deleting a section from
 * index.html does not stop the rest of the page from working.
 *
 * Contents
 *   1. Questionnaire content (PHQ-9 and GAD-7, exact published wording)
 *   2. Scoring and result wording (pure functions with no page access; unit-tested)
 *   3. Small page helpers
 *   4. Mobile menu
 *   5. Self-assessment tabs
 *   6. Questionnaires: questions, the question 9 notice, results
 *   7. "Add this result to my message"
 *   8. Contact form (sends with fetch; without JavaScript it posts normally)
 *   9. "Message received" dialog
 *  10. Service buttons on the price cards
 *  11. Start-up
 *
 * Tailwind note: every class this file adds is written out in full in a string below, so the
 * CSS build (tools/build-css.sh) can find it. Never build a class name out of pieces.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * 1. Questionnaire content
   * ------------------------------------------------------------------ */

  // The four answers, scored 0-3, as published for both questionnaires.
  var ANSWER_OPTIONS = [
    { label: 'Not at all', value: 0 },
    { label: 'Several days', value: 1 },
    { label: 'More than half the days', value: 2 },
    { label: 'Nearly every day', value: 3 }
  ];

  // Summaries are always listed in this order: PHQ-9 first, then GAD-7.
  var QUESTIONNAIRE_KEYS = ['phq', 'gad'];

  var QUESTIONNAIRES = {
    phq: {
      name: 'PHQ-9',
      max: 27,
      // Exact published PHQ-9 wording. Do not shorten or reword: an altered questionnaire is no
      // longer the validated one. Question 9 is the self-harm question (see section 6).
      items: [
        'Little interest or pleasure in doing things',
        'Feeling down, depressed, or hopeless',
        'Trouble falling or staying asleep, or sleeping too much',
        'Feeling tired or having little energy',
        'Poor appetite or overeating',
        'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
        'Trouble concentrating on things, such as reading the newspaper or watching television',
        'Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
        'Thoughts that you would be better off dead, or of hurting yourself in some way'
      ],
      // Published bands, each given as the highest total in that band.
      bands: [
        { upTo: 4, band: 'minimal' },
        { upTo: 9, band: 'mild' },
        { upTo: 14, band: 'moderate' },
        { upTo: 19, band: 'moderately severe' },
        { upTo: 27, band: 'severe' }
      ]
    },
    gad: {
      name: 'GAD-7',
      max: 21,
      // Exact published GAD-7 wording.
      items: [
        'Feeling nervous, anxious, or on edge',
        'Not being able to stop or control worrying',
        'Worrying too much about different things',
        'Trouble relaxing',
        'Being so restless that it is hard to sit still',
        'Becoming easily annoyed or irritable',
        'Feeling afraid, as if something awful might happen'
      ],
      bands: [
        { upTo: 4, band: 'minimal' },
        { upTo: 9, band: 'mild' },
        { upTo: 14, band: 'moderate' },
        { upTo: 21, band: 'severe' }
      ]
    }
  };

  // PHQ-9 question 9 (thoughts of being better off dead, or of self-harm), counted from 1.
  var PHQ_SELF_HARM_QUESTION = 9;


  /* ------------------------------------------------------------------
   * 2. Scoring and result wording (no page access, so they can be tested on their own)
   * ------------------------------------------------------------------ */

  // answers: one entry per question, each 0-3, or null when not answered yet.
  // Returns { total: number, missing: [unanswered question numbers, counted from 1] }.
  function scoreAnswers(answers) {
    var total = 0;
    var missing = [];
    for (var i = 0; i < answers.length; i++) {
      var answer = answers[i];
      if (answer === 0 || answer === 1 || answer === 2 || answer === 3) {
        total += answer;
      } else {
        missing.push(i + 1);
      }
    }
    return { total: total, missing: missing };
  }

  // The published band for a total, e.g. bandFor('phq', 12) gives 'moderate'.
  // Gives null for anything that is not a whole number in range.
  function bandFor(key, total) {
    var q = QUESTIONNAIRES[key];
    if (!q || typeof total !== 'number' || total % 1 !== 0 || total < 0 || total > q.max) {
      return null;
    }
    for (var i = 0; i < q.bands.length; i++) {
      if (total <= q.bands[i].upTo) {
        return q.bands[i].band;
      }
    }
    return null;
  }

  // The one-line summary a visitor can choose to add to the contact form, e.g.
  // "PHQ-9 score: 12/27 (moderate range)". The server accepts exactly this format.
  // It carries only the total and its band, never single answers, so never question 9.
  function summaryFor(key, total) {
    var band = bandFor(key, total);
    if (band === null) {
      return '';
    }
    var q = QUESTIONNAIRES[key];
    return q.name + ' score: ' + total + '/' + q.max + ' (' + band + ' range)';
  }

  // What goes in the hidden "assessment" field: nothing, or one or two summaries joined by "; ".
  function joinSummaries(attachedSummaries) {
    var parts = [];
    QUESTIONNAIRE_KEYS.forEach(function (key) {
      if (attachedSummaries && attachedSummaries[key]) {
        parts.push(attachedSummaries[key]);
      }
    });
    return parts.join('; ');
  }

  // True when PHQ-9 question 9 has any answer other than "Not at all".
  function selfHarmAnswered(answers) {
    var answer = answers[PHQ_SELF_HARM_QUESTION - 1];
    return answer === 1 || answer === 2 || answer === 3;
  }

  // [3] gives "question 3", [3, 9] gives "questions 3 and 9", [2, 3, 9] gives "questions 2, 3 and 9".
  function describeQuestions(numbers) {
    if (numbers.length === 1) {
      return 'question ' + numbers[0];
    }
    return 'questions ' + numbers.slice(0, -1).join(', ') + ' and ' + numbers[numbers.length - 1];
  }

  // The note shown next to the Calculate button when some questions have no answer.
  function missingMessage(numbers, questionCount) {
    if (numbers.length === questionCount) {
      return 'Please answer all ' + questionCount + ' questions to see your score.';
    }
    return 'Please answer ' + describeQuestions(numbers) + ' to see your score.';
  }

  // Badge colours. Colour is never the only signal: the badge text always names the range.
  var BADGE_BASE = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide';
  var BADGE_COLOURS = {
    'minimal': 'bg-emerald-100 text-emerald-800',
    'mild': 'bg-blue-100 text-blue-800',
    'moderate': 'bg-amber-100 text-amber-800',
    'moderately severe': 'bg-rose-100 text-rose-800',
    'severe': 'bg-rose-200 text-rose-900'
  };
  // A neutral colour used instead of green or blue when PHQ-9 question 9 was answered above
  // "Not at all", so that a low total never looks like reassurance.
  var BADGE_COLOUR_QUESTION_9 = 'bg-sand-200 text-sage-900';

  // Result wording: it describes the range, never diagnoses and never sells.
  var NO_DIAGNOSIS = 'A questionnaire cannot diagnose anything.';
  // Shown FIRST in the PHQ-9 result whenever question 9 was answered above "Not at all".
  var QUESTION_9_WORDING = 'Whatever the overall score, your answer to question 9 matters, and you deserve support. ' +
    'Please talk to your GP soon, or to one of the services listed here.';
  var REASSURANCE = 'A questionnaire cannot diagnose anything, but this is generally a reassuring result. ' +
    'If something is still on your mind, it can help to talk it over with someone you trust.';

  var RESULT_WORDING = {
    phq: {
      describe: {
        'minimal': 'Scores in this range are usually described as minimal symptoms of low mood.',
        'mild': 'Scores in this range are usually described as mild symptoms of low mood.',
        'moderate': 'Scores in this range are usually described as moderate symptoms of low mood.',
        'moderately severe': 'Scores in this range are usually described as moderately severe symptoms of low mood.',
        'severe': 'Scores in this range are usually described as severe symptoms of low mood.'
      },
      advice: {
        'minimal': REASSURANCE,
        'mild': 'A questionnaire cannot diagnose anything; if these feelings carry on or start to affect your daily life, talking to your GP or a counsellor can help.',
        'moderate': 'A questionnaire cannot diagnose anything; if these feelings are affecting your daily life, talking to your GP or a counsellor is a sensible next step.',
        'moderately severe': 'A questionnaire cannot diagnose anything, but it would be a good idea to talk to your GP about how you have been feeling. A counsellor can also offer support alongside this.',
        'severe': 'A questionnaire cannot diagnose anything, but please talk to your GP soon about how you have been feeling. If you feel unable to cope, the services below can help straight away.'
      }
    },
    gad: {
      describe: {
        'minimal': 'Scores in this range are usually described as minimal symptoms of anxiety.',
        'mild': 'Scores in this range are usually described as mild symptoms of anxiety.',
        'moderate': 'Scores in this range are usually described as moderate symptoms of anxiety.',
        'severe': 'Scores in this range are usually described as severe symptoms of anxiety.'
      },
      advice: {
        'minimal': REASSURANCE,
        'mild': 'A questionnaire cannot diagnose anything; if worry carries on or starts to affect your daily life, talking to your GP or a counsellor can help.',
        'moderate': 'A questionnaire cannot diagnose anything; if anxiety is affecting your daily life, talking to your GP or a counsellor is a sensible next step.',
        'severe': 'A questionnaire cannot diagnose anything, but it would be a good idea to talk to your GP soon about how you have been feeling. A counsellor can also offer support alongside this.'
      }
    }
  };

  // Everything a result box shows, for one questionnaire and total.
  // selfHarm: true when PHQ-9 question 9 was answered above "Not at all" (ignored for the GAD-7).
  function resultFor(key, total, selfHarm) {
    var band = bandFor(key, total);
    if (band === null) {
      return null;
    }
    var q = QUESTIONNAIRES[key];
    var wording = RESULT_WORDING[key];
    var question9 = key === 'phq' && selfHarm === true;
    var badgeColour = BADGE_COLOURS[band];
    var text;

    if (question9) {
      // Question 9 comes first, whatever the band, then the range, then the no-diagnosis sentence.
      // The band's own advice is left out, so there is no reassurance and the GP advice is not repeated.
      text = QUESTION_9_WORDING + ' ' + wording.describe[band] + ' ' + NO_DIAGNOSIS;
      if (band === 'minimal' || band === 'mild') {
        // No green or blue badge when question 9 is above zero.
        badgeColour = BADGE_COLOUR_QUESTION_9;
      }
    } else {
      text = wording.describe[band] + ' ' + wording.advice[band];
    }

    return {
      band: band,
      title: q.name + ' score: ' + total + ' out of ' + q.max,
      badgeText: band.charAt(0).toUpperCase() + band.slice(1) + ' range',
      badgeClass: BADGE_BASE + ' ' + badgeColour,
      text: text,
      summary: summaryFor(key, total),
      question9: question9
    };
  }

  // Unit tests (run with Node) reach the functions above through this. In a browser there is
  // no "module", so nothing is exported and nothing is added to the page's global scope.
  if (typeof module === 'object' && module && typeof module.exports === 'object') {
    module.exports = {
      ANSWER_OPTIONS: ANSWER_OPTIONS,
      QUESTIONNAIRES: QUESTIONNAIRES,
      scoreAnswers: scoreAnswers,
      bandFor: bandFor,
      summaryFor: summaryFor,
      joinSummaries: joinSummaries,
      selfHarmAnswered: selfHarmAnswered,
      describeQuestions: describeQuestions,
      missingMessage: missingMessage,
      resultFor: resultFor
    };
  }
  if (typeof document === 'undefined') {
    return;
  }


  /* ------------------------------------------------------------------
   * 3. Small page helpers
   * ------------------------------------------------------------------ */

  function byId(id) {
    return document.getElementById(id);
  }

  // Uses the hidden attribute (the stylesheet makes [hidden] always invisible).
  function setHidden(node, hidden) {
    if (!node) {
      return;
    }
    if (hidden) {
      node.setAttribute('hidden', '');
    } else {
      node.removeAttribute('hidden');
    }
  }

  function isHidden(node) {
    return !node || node.hasAttribute('hidden');
  }

  function forEachNode(nodeList, fn) {
    Array.prototype.forEach.call(nodeList, fn);
  }

  // Swaps one set of classes for another. Both arguments are complete class strings.
  function swapClasses(node, remove, add) {
    remove.split(' ').forEach(function (name) { node.classList.remove(name); });
    add.split(' ').forEach(function (name) { node.classList.add(name); });
  }

  // Builds an element: el('p', { class: '...' }, ['some text', otherNode]).
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (name) {
        node.setAttribute(name, attrs[name]);
      });
    }
    (children || []).forEach(function (child) {
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Scrolls something into view, smoothly unless the visitor has asked for less motion.
  function bringIntoView(node) {
    if (!node || typeof node.scrollIntoView !== 'function') {
      return;
    }
    try {
      node.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
      node.scrollIntoView();
    }
  }

  // Moves keyboard focus without making the page jump (it has usually just been scrolled).
  function focusQuietly(node) {
    if (!node || typeof node.focus !== 'function') {
      return;
    }
    try {
      node.focus({ preventScroll: true });
    } catch (e) {
      node.focus();
    }
  }

  function isEscape(event) {
    return event.key === 'Escape' || event.key === 'Esc';
  }


  /* ------------------------------------------------------------------
   * 4. Mobile menu
   * ------------------------------------------------------------------ */

  function initMobileMenu() {
    var button = byId('mobile-menu-btn');
    var menu = byId('mobile-menu');
    if (!button || !menu) {
      return;
    }
    var openIcon = button.querySelector('[data-menu-icon="open"]');
    var closeIcon = button.querySelector('[data-menu-icon="close"]');

    function setOpen(open) {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      setHidden(menu, !open);
      setHidden(openIcon, open);
      setHidden(closeIcon, !open);
    }

    // The button only appears once this script is running (the menu cannot open without it).
    setHidden(button, false);

    button.addEventListener('click', function () {
      setOpen(isHidden(menu));
    });

    // Close the menu when a link in it is tapped, so it does not cover the section.
    menu.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('a')) {
        setOpen(false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (isEscape(event) && !isHidden(menu)) {
        setOpen(false);
        button.focus();
      }
    });

    // If the window is widened to desktop size while the menu is open, the button and menu are
    // replaced by the desktop links. Close the menu so aria-expanded and the icon stay correct
    // (and the menu is not still open if the window is made narrow again).
    // 1024px is where Tailwind's "lg:" classes in index.html switch to the desktop header.
    if (typeof window.matchMedia === 'function') {
      var desktop = window.matchMedia('(min-width: 1024px)');
      var onWidthChange = function () {
        if (desktop.matches && !isHidden(menu)) {
          setOpen(false);
        }
      };
      if (typeof desktop.addEventListener === 'function') {
        desktop.addEventListener('change', onWidthChange);
      } else if (typeof desktop.addListener === 'function') {
        desktop.addListener(onWidthChange); // older Safari
      }
    }
  }


  /* ------------------------------------------------------------------
   * 5. Self-assessment tabs (real tabs: arrow keys, Home and End move between them)
   * ------------------------------------------------------------------ */

  var TAB_ON = 'bg-sage-600 text-white shadow ring-2 ring-sage-300';
  var TAB_OFF = 'text-sage-300 hover:text-white';

  function initTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"][data-tab]'));
    if (!tabs.length) {
      return;
    }

    function select(tab, moveFocus) {
      tabs.forEach(function (other) {
        var on = other === tab;
        other.setAttribute('aria-selected', on ? 'true' : 'false');
        other.setAttribute('tabindex', on ? '0' : '-1');
        swapClasses(other, on ? TAB_OFF : TAB_ON, on ? TAB_ON : TAB_OFF);
        // Each questionnaire has its own panel and its own result, so switching never shows
        // one questionnaire's result under the other.
        setHidden(byId(other.getAttribute('aria-controls')), !on);
      });
      if (moveFocus) {
        tab.focus();
      }
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () {
        select(tab, false);
      });
      tab.addEventListener('keydown', function (event) {
        var next = null;
        if (event.key === 'ArrowRight' || event.key === 'Right') {
          next = tabs[(index + 1) % tabs.length];
        } else if (event.key === 'ArrowLeft' || event.key === 'Left') {
          next = tabs[(index - 1 + tabs.length) % tabs.length];
        } else if (event.key === 'Home') {
          next = tabs[0];
        } else if (event.key === 'End') {
          next = tabs[tabs.length - 1];
        }
        if (next) {
          event.preventDefault();
          select(next, true);
        }
      });
    });
  }


  /* ------------------------------------------------------------------
   * 6. Questionnaires
   * ------------------------------------------------------------------ */

  // The latest calculated total for each questionnaire, e.g. { phq: { total: 12 } }.
  var lastResults = {};

  // Classes for the questions this script draws (written in full for Tailwind).
  // A question the visitor missed gets data-unanswered="true", which draws the terracotta border.
  var FIELDSET_CLASS = 'min-w-0 bg-sand-50/70 p-4 rounded-2xl border border-sage-100 data-[unanswered=true]:border-terracotta-600 data-[unanswered=true]:ring-1 data-[unanswered=true]:ring-terracotta-600';
  var LEGEND_CLASS = 'float-left w-full mb-3 text-sm sm:text-base font-semibold text-sage-900';
  var OPTIONS_CLASS = 'clear-both grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-2';
  var OPTION_CLASS = 'flex items-center gap-3 bg-white px-3 py-2 min-h-[44px] rounded-xl border border-sage-200 hover:border-sage-500 has-[:checked]:border-sage-600 has-[:checked]:bg-sage-50 cursor-pointer text-sm';
  var RADIO_CLASS = 'w-5 h-5 flex-shrink-0';
  var OPTION_TEXT_CLASS = 'text-slate-700';
  var QUESTION_9_LIVE_CLASS = '[&:not(:empty)]:mt-4';

  // Classes for the question 9 notice.
  var NOTICE_CLASS = 'p-4 rounded-2xl bg-sand-100 border border-sand-300 text-slate-800 space-y-3';
  var NOTICE_TEXT_CLASS = 'text-base';
  var NOTICE_LIST_CLASS = 'space-y-2';
  var NOTICE_ITEM_CLASS = 'flex flex-wrap items-center gap-x-3 gap-y-1';
  var NOTICE_CALL_CLASS = 'inline-flex items-center justify-center min-h-[44px] px-4 rounded-full bg-sage-700 hover:bg-sage-800 text-white font-bold';
  var NOTICE_DETAIL_CLASS = 'text-sm sm:text-base text-slate-700';
  var NOTICE_LINK_CLASS = 'font-semibold text-sage-800 underline';

  function radioName(key, number) {
    return key + '-q' + number;
  }

  // Draws every question as a fieldset (the question is its legend) with four labelled radios.
  function renderQuestions(form, key) {
    var list = form.querySelector('[data-questions]');
    if (!list) {
      return false;
    }
    list.textContent = '';
    QUESTIONNAIRES[key].items.forEach(function (text, index) {
      var number = index + 1;
      var fieldset = el('fieldset', { 'class': FIELDSET_CLASS, 'data-question': String(number) });
      fieldset.appendChild(el('legend', { 'class': LEGEND_CLASS }, [number + '. ' + text]));

      var options = el('div', { 'class': OPTIONS_CLASS });
      ANSWER_OPTIONS.forEach(function (option) {
        var id = radioName(key, number) + '-' + option.value;
        var radio = el('input', {
          'type': 'radio',
          'id': id,
          'name': radioName(key, number),
          'value': String(option.value),
          'class': RADIO_CLASS
        });
        options.appendChild(el('label', { 'for': id, 'class': OPTION_CLASS }, [
          radio,
          el('span', { 'class': OPTION_TEXT_CLASS }, [option.label])
        ]));
      });
      fieldset.appendChild(options);

      // Directly under PHQ-9 question 9: an always-present, empty status area. The notice is
      // put inside it the moment the visitor picks any answer other than "Not at all".
      if (key === 'phq' && number === PHQ_SELF_HARM_QUESTION) {
        fieldset.appendChild(el('div', { 'id': 'phq-q9-notice', 'role': 'status', 'class': QUESTION_9_LIVE_CLASS }));
      }
      list.appendChild(fieldset);
    });
    return true;
  }

  // The answers currently ticked, one per question: 0-3, or null when not answered.
  function readAnswers(form, key) {
    var answers = [];
    var count = QUESTIONNAIRES[key].items.length;
    for (var number = 1; number <= count; number++) {
      var checked = form.querySelector('input[name="' + radioName(key, number) + '"]:checked');
      answers.push(checked ? parseInt(checked.value, 10) : null);
    }
    return answers;
  }

  // The calm notice shown when PHQ-9 question 9 is answered above "Not at all".
  // Used under question 9 and again at the top of the PHQ-9 result.
  function buildQuestion9Notice() {
    var calls = [
      ['tel:999', 'Call 999', 'if you are in immediate danger or cannot keep yourself safe'],
      ['tel:111', 'Call NHS 111', 'for urgent mental health help (choose the mental health option)'],
      ['tel:116123', 'Call 116 123', 'to talk to Samaritans, free, at any time']
    ];
    var list = el('ul', { 'class': NOTICE_LIST_CLASS });
    calls.forEach(function (call) {
      list.appendChild(el('li', { 'class': NOTICE_ITEM_CLASS }, [
        el('a', { 'href': call[0], 'class': NOTICE_CALL_CLASS }, [call[1]]),
        el('span', { 'class': NOTICE_DETAIL_CLASS }, [call[2]])
      ]));
    });
    return el('div', { 'class': NOTICE_CLASS }, [
      el('p', { 'class': NOTICE_TEXT_CLASS }, ['Thank you for answering honestly. Thoughts like these are more common than people realise, and help is available right now.']),
      list,
      el('p', { 'class': NOTICE_TEXT_CLASS }, [
        el('a', { 'href': '#urgent-help', 'class': NOTICE_LINK_CLASS }, ['More places to get urgent help'])
      ])
    ]);
  }

  // Shows or clears the notice under question 9 to match the current answer.
  function updateQuestion9Notice(form) {
    var live = byId('phq-q9-notice');
    if (!live) {
      return;
    }
    var show = selfHarmAnswered(readAnswers(form, 'phq'));
    if (show && !live.firstChild) {
      live.appendChild(buildQuestion9Notice());
    } else if (!show && live.firstChild) {
      live.textContent = '';
    }
  }

  function clearQuestion9Notice() {
    var live = byId('phq-q9-notice');
    if (live) {
      live.textContent = '';
    }
  }

  function clearUnanswered(form) {
    forEachNode(form.querySelectorAll('fieldset[data-unanswered]'), function (fieldset) {
      fieldset.removeAttribute('data-unanswered');
    });
  }

  function hideMissing(note) {
    if (note) {
      note.textContent = '';
      setHidden(note, true);
    }
  }

  // Says which questions still need an answer, marks them, and puts focus on the first one.
  // Only a press of Calculate makes the note an alert (read out straight away by screen readers).
  function showMissing(form, note, key, missing) {
    if (note) {
      note.setAttribute('role', 'alert');
      note.textContent = missingMessage(missing, QUESTIONNAIRES[key].items.length);
      setHidden(note, false);
    }
    missing.forEach(function (number) {
      var fieldset = form.querySelector('fieldset[data-question="' + number + '"]');
      if (fieldset) {
        fieldset.setAttribute('data-unanswered', 'true');
      }
    });
    var first = form.querySelector('fieldset[data-question="' + missing[0] + '"] input');
    if (first) {
      first.focus();
    }
  }

  function hideResult(key) {
    setHidden(byId(key + '-result'), true);
  }

  // "Reset questionnaire" takes two presses, so one mis-tap cannot wipe every answer. The first press
  // only changes the button's words for a few seconds; pressing again within that time clears the form.
  // No pop-up box is used. Returns a function that puts the button back to normal.
  var RESET_CONFIRM_TEXT = 'Press again to clear your answers';
  var RESET_CONFIRM_MS = 5000;

  function initResetConfirm(form) {
    var button = form.querySelector('button[type="reset"]');
    if (!button) {
      return function () {};
    }
    var idleText = button.textContent;
    var status = form.querySelector('[data-reset-status]');
    var armed = false;
    var timer = null;

    function setStatus(message) {
      if (status) {
        status.textContent = message;
      }
    }

    function disarm() {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (armed) {
        armed = false;
        button.textContent = idleText;
        setStatus('');
      }
    }

    button.addEventListener('click', function (event) {
      if (armed) {
        return; // the second press: the browser now resets the form, and the form's reset listener tidies up
      }
      event.preventDefault();
      armed = true;
      button.textContent = RESET_CONFIRM_TEXT;
      setStatus(RESET_CONFIRM_TEXT);
      timer = window.setTimeout(disarm, RESET_CONFIRM_MS);
    });
    return disarm;
  }

  // Fills in and shows a questionnaire's own result box, then moves focus to it.
  function showResult(key, total, selfHarm) {
    var box = byId(key + '-result');
    var result = resultFor(key, total, selfHarm);
    if (!box || !result) {
      return;
    }
    lastResults[key] = { total: total };

    var badge = box.querySelector('[data-result-badge]');
    if (badge) {
      badge.className = result.badgeClass;
      badge.textContent = result.badgeText;
    }
    var title = box.querySelector('[data-result-title]');
    if (title) {
      title.textContent = result.title;
    }
    var text = box.querySelector('[data-result-text]');
    if (text) {
      text.textContent = result.text;
    }
    // The question 9 notice is repeated at the top of the result, above the score.
    var slot = box.querySelector('[data-q9-slot]');
    if (slot) {
      slot.textContent = '';
      if (result.question9) {
        slot.appendChild(buildQuestion9Notice());
      }
      setHidden(slot, !result.question9);
    }

    updateAddConfirmations();
    setHidden(box, false);
    bringIntoView(box);
    focusQuietly(box);
  }

  function initQuestionnaire(key) {
    var form = byId(key + '-form');
    if (!form || !renderQuestions(form, key)) {
      return false;
    }
    var note = form.querySelector('[data-missing]');
    var disarmReset = initResetConfirm(form);

    form.addEventListener('change', function (event) {
      var target = event.target;
      if (!target || target.type !== 'radio') {
        return;
      }
      var fieldset = target.closest ? target.closest('fieldset') : null;
      if (fieldset) {
        fieldset.removeAttribute('data-unanswered');
      }
      // Keep the "please answer" note in step with what is still missing. It is updated quietly:
      // it stops being an alert, so a screen reader is not interrupted after every answer.
      if (note && !isHidden(note)) {
        note.removeAttribute('role');
        var missing = scoreAnswers(readAnswers(form, key)).missing;
        if (missing.length) {
          note.textContent = missingMessage(missing, QUESTIONNAIRES[key].items.length);
        } else {
          hideMissing(note);
        }
      }
      // A result shown earlier no longer matches the answers, so it goes until Calculate is pressed again.
      hideResult(key);
      if (key === 'phq') {
        updateQuestion9Notice(form);
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var answers = readAnswers(form, key);
      var scored = scoreAnswers(answers);
      clearUnanswered(form);
      if (scored.missing.length) {
        hideResult(key);
        showMissing(form, note, key, scored.missing);
        return;
      }
      hideMissing(note);
      showResult(key, scored.total, key === 'phq' && selfHarmAnswered(answers));
    });

    // The form is being reset (the second press of "Reset questionnaire", or after a message is sent).
    // This runs just before the browser clears the answers.
    form.addEventListener('reset', function () {
      disarmReset();
      clearUnanswered(form);
      hideMissing(note);
      hideResult(key);
      delete lastResults[key];
      if (key === 'phq') {
        clearQuestion9Notice();
      }
    });

    return true;
  }

  // Clears both questionnaires and hides their results (used after a message is sent, so the next
  // person to use this computer does not see them).
  function resetQuestionnaires() {
    QUESTIONNAIRE_KEYS.forEach(function (key) {
      var form = byId(key + '-form');
      if (form) {
        form.reset();
      }
      hideResult(key);
      delete lastResults[key];
    });
    clearQuestion9Notice();
  }


  /* ------------------------------------------------------------------
   * 7. "Add this result to my message"
   *    Calculating a score never puts it in the contact form. Only this button does, and the
   *    visitor can take it out again with "Remove".
   * ------------------------------------------------------------------ */

  // The summaries the visitor chose to add, e.g. { phq: 'PHQ-9 score: 12/27 (moderate range)' }.
  var attached = {};

  var ATTACHED_ITEM_CLASS = 'flex flex-wrap items-center justify-between gap-2 bg-sand-50 rounded-lg px-3 py-1';
  var ATTACHED_TEXT_CLASS = 'text-sm text-slate-800';
  var REMOVE_BUTTON_CLASS = 'text-sm font-semibold text-sage-800 underline min-h-[44px] px-3 rounded-full hover:bg-sage-100';

  // Shows "Added to your message." under a result only while that exact result is attached.
  function updateAddConfirmations() {
    QUESTIONNAIRE_KEYS.forEach(function (key) {
      var box = byId(key + '-result');
      if (!box) {
        return;
      }
      var last = lastResults[key];
      var isAttached = !!(last && attached[key] && attached[key] === summaryFor(key, last.total));
      setHidden(box.querySelector('[data-add-confirm]'), !isAttached);
    });
  }

  // The visible list of attached results in the contact form, or null if it is not on the page.
  function attachmentList() {
    var box = byId('cf-assessment-summary');
    return box ? box.querySelector('[data-assessment-list]') : null;
  }

  // Copies the attached summaries into the hidden field (what is sent) and the visible list.
  function renderAttachments() {
    var value = joinSummaries(attached);
    var input = byId('cf-assessment');
    if (input) {
      input.value = value;
    }
    var box = byId('cf-assessment-summary');
    var list = attachmentList();
    // "Self-check result added" for one, "Self-check results added" for two.
    var count = QUESTIONNAIRE_KEYS.filter(function (key) { return !!attached[key]; }).length;
    if (box) {
      setHidden(box.querySelector('[data-heading-one]'), count > 1);
      setHidden(box.querySelector('[data-heading-many]'), count < 2);
    }
    if (list) {
      list.textContent = '';
      QUESTIONNAIRE_KEYS.forEach(function (key) {
        if (!attached[key]) {
          return;
        }
        var remove = el('button', {
          'type': 'button',
          'class': REMOVE_BUTTON_CLASS,
          'aria-label': 'Remove ' + QUESTIONNAIRES[key].name + ' result from your message'
        }, ['Remove']);
        remove.addEventListener('click', function () {
          removeAttachment(key);
        });
        list.appendChild(el('li', { 'class': ATTACHED_ITEM_CLASS }, [
          el('span', { 'class': ATTACHED_TEXT_CLASS }, [attached[key]]),
          remove
        ]));
      });
    }
    setHidden(box, value === '');
    clearFieldError('assessment');
    updateAddConfirmations();
  }

  function addResultToMessage(key) {
    var last = lastResults[key];
    var summary = last ? summaryFor(key, last.total) : '';
    if (!summary || !attachmentList()) {
      return; // never fill the hidden field with nothing on screen to show for it
    }
    attached[key] = summary;
    renderAttachments();
    var box = byId('cf-assessment-summary');
    if (box && !isHidden(box)) {
      bringIntoView(box);
      focusQuietly(box);
    }
  }

  function removeAttachment(key) {
    delete attached[key];
    renderAttachments();
    var box = byId('cf-assessment-summary');
    var next = box && !isHidden(box) ? box.querySelector('button') : byId('cf-message');
    focusQuietly(next);
  }

  function clearAttachments() {
    attached = {};
    renderAttachments();
  }

  function initAddButtons() {
    // The hidden field must always match what the visitor can see. Some browsers put an old value
    // back into a hidden field when the page is reloaded or reopened with Back, so empty it (to match
    // the empty list) now, and bring the two into line again whenever the page is shown.
    renderAttachments();
    window.addEventListener('pageshow', function () {
      renderAttachments();
    });

    // A result may only be added if the visitor will see it in the form, with its Remove button.
    // Without the contact form's hidden field or its visible list, hide the offer instead.
    if (!byId('cf-assessment') || !attachmentList()) {
      forEachNode(document.querySelectorAll('[data-add-row]'), function (row) {
        setHidden(row, true);
      });
      return;
    }
    forEachNode(document.querySelectorAll('[data-add-result]'), function (button) {
      button.addEventListener('click', function () {
        addResultToMessage(button.getAttribute('data-add-result'));
      });
    });
  }


  /* ------------------------------------------------------------------
   * 8. Contact form
   *    Without JavaScript the form posts normally and the server shows /thanks.html.
   *    With JavaScript it is sent with fetch and the answer is shown on this page.
   * ------------------------------------------------------------------ */

  // The fields the server can report a problem with, in the order they appear on the page.
  var CONTACT_FIELDS = ['name', 'email', 'phone', 'service', 'assessment', 'message', 'consent'];
  var pageStart = Date.now();
  // If the server has not answered after this long, stop waiting and show the "could not be sent"
  // message (which gives the email address) rather than leaving "Sending…" on the button.
  var SEND_TIMEOUT_MS = 30000;
  // The server drops messages sent sooner than 2500 ms after page load; stay safely above that.
  var MIN_ELAPSED_MS = 3000;

  function msSinceLoad() {
    if (window.performance && typeof window.performance.now === 'function') {
      return Math.round(window.performance.now());
    }
    return Date.now() - pageStart;
  }

  function clearFieldError(field) {
    var message = byId('cf-' + field + '-error');
    if (message) {
      message.textContent = '';
      setHidden(message, true);
    }
    var control = byId('cf-' + field);
    if (control) {
      control.removeAttribute('aria-invalid');
    }
  }

  function clearAllErrors() {
    CONTACT_FIELDS.forEach(clearFieldError);
    setHidden(byId('cf-status'), true);
  }

  // Shows each of the server's messages beside its field and focuses the first such field.
  // Returns how many messages could be shown.
  function showFieldErrors(errors) {
    var shown = 0;
    CONTACT_FIELDS.forEach(function (field) {
      if (!Object.prototype.hasOwnProperty.call(errors, field)) {
        return;
      }
      var message = byId('cf-' + field + '-error');
      if (!message) {
        return;
      }
      message.textContent = String(errors[field]);
      setHidden(message, false);
      var control = byId('cf-' + field);
      if (control && field !== 'assessment') {
        control.setAttribute('aria-invalid', 'true');
      }
      shown += 1;
      if (shown === 1) {
        var target = control;
        if (field === 'assessment') {
          var box = byId('cf-assessment-summary');
          target = box && !isHidden(box) ? box : byId('cf-message');
        }
        if (target) {
          bringIntoView(target);
          focusQuietly(target);
        }
      }
    });
    return shown;
  }

  // The plain message above the Send button when sending fails (both versions include the email
  // address). kind 'closed': the server has paused the form, so "try again later" would not help.
  function showSendFailure(kind) {
    var status = byId('cf-status');
    if (!status) {
      return;
    }
    var closed = status.querySelector('[data-status-closed]');
    var useClosed = kind === 'closed' && !!closed;
    setHidden(status.querySelector('[data-status-failed]'), useClosed);
    setHidden(closed, !useClosed);
    setHidden(status, false);
    // Sending disabled the Send button, which took keyboard focus away from it: move focus to the
    // message so keyboard and screen reader users are not left at the top of the page.
    if (typeof status.focus === 'function') {
      status.focus();
    }
  }

  function initContactForm() {
    var form = byId('contact-form');
    if (!form) {
      return;
    }
    var submit = byId('cf-submit');
    var label = submit ? submit.querySelector('[data-submit-label]') : null;
    var idleText = label ? label.textContent : '';
    var elapsed = byId('cf-elapsed');
    var sending = false;

    function setSending(on) {
      sending = on;
      if (submit) {
        submit.disabled = on;
      }
      if (label) {
        label.textContent = on ? 'Sending…' : idleText;
      }
      if (on) {
        form.setAttribute('aria-busy', 'true');
      } else {
        form.removeAttribute('aria-busy');
      }
    }
    // Some browsers bring a disabled Send button back disabled when the page is reloaded, so start
    // from "not sending".
    setSending(false);

    // A field's error message goes as soon as the visitor changes that field.
    function onEdit(event) {
      var name = event.target && event.target.name;
      if (name && CONTACT_FIELDS.indexOf(name) !== -1) {
        clearFieldError(name);
      }
    }
    form.addEventListener('input', onEdit);
    form.addEventListener('change', onEdit);

    function sent() {
      form.reset();
      clearAttachments();
      resetQuestionnaires();
      clearAllErrors();
      if (elapsed) {
        elapsed.value = '';
        elapsed.disabled = true;
      }
      openSuccessDialog(submit);
    }

    form.addEventListener('submit', function (event) {
      // How long the page has been open. The server uses it to spot robots, which send instantly.
      // It stays disabled (so it is not sent at all) when JavaScript is off.
      if (elapsed) {
        elapsed.value = String(msSinceLoad());
        elapsed.disabled = false;
      }
      if (typeof window.fetch !== 'function' || typeof window.FormData !== 'function' ||
          typeof window.URLSearchParams !== 'function') {
        return; // An older browser: let the form post normally.
      }
      event.preventDefault();
      if (sending) {
        return;
      }
      clearAllErrors();
      setSending(true);

      // The server quietly drops anything sent less than MIN_ELAPSED_MS after the page loaded (its
      // robot trap) while still answering "success". A real visitor can get there, for example when
      // the browser restores what they typed after a reload, so hold the send until the time is up.
      // The button stays on "Sending…" meanwhile, and the guard above ignores further clicks.
      var wait = MIN_ELAPSED_MS - msSinceLoad();
      if (wait > 0) {
        window.setTimeout(startSend, wait + 20);
      } else {
        startSend();
      }
    });

    function startSend() {
      // Measured again now, so the server sees the true time since the page loaded.
      if (elapsed) {
        elapsed.value = String(msSinceLoad());
        elapsed.disabled = false;
      }
      // Sent the same way as a normal form post, so the server sees exactly the same fields.
      var body = new URLSearchParams();
      new window.FormData(form).forEach(function (value, name) {
        body.append(name, value);
      });

      // Give up after SEND_TIMEOUT_MS. Stopping the request makes fetch fail, which shows the
      // "could not be sent" message below. (Very old browsers without AbortController just wait.)
      var options = {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: body,
        credentials: 'same-origin'
      };
      var timer = null;
      if (typeof window.AbortController === 'function') {
        var controller = new window.AbortController();
        options.signal = controller.signal;
        timer = window.setTimeout(function () {
          controller.abort();
        }, SEND_TIMEOUT_MS);
      }
      function finished() {
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
        setSending(false);
      }

      window.fetch(form.getAttribute('action') || '/contact.php', options).then(function (response) {
        return response.text().then(function (text) {
          var data = null;
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = null;
          }
          return { response: response, data: data };
        });
      }).then(function (reply) {
        var response = reply.response;
        var data = reply.data;
        finished();
        if (response.ok && data && data.ok === true) {
          sent();
          return;
        }
        // The server answered the way it does without JavaScript (a redirect to the thank-you
        // page), which still means the message went.
        if (response.ok && response.redirected && /\/thanks\.html(?:[?#]|$)/.test(response.url || '')) {
          sent();
          return;
        }
        if (response.status === 422 && data && data.errors && typeof data.errors === 'object' &&
            showFieldErrors(data.errors) > 0) {
          return;
        }
        // The server has paused the form for everyone for now ({"ok":false,"error":"closed"}).
        if (data && data.error === 'closed') {
          showSendFailure('closed');
          return;
        }
        // 429 (too many messages), a server error, or anything unexpected.
        showSendFailure('failed');
      }).catch(function () {
        // No connection, the request never completed, or it took too long and was stopped.
        finished();
        showSendFailure('failed');
      });
    }
  }


  /* ------------------------------------------------------------------
   * 9. "Message received" dialog
   *    A proper dialog: focus moves in and is kept there, Escape or a click on the dimmed
   *    background closes it, and focus goes back where it was.
   * ------------------------------------------------------------------ */

  var dialog = null; // { overlay, box, returnFocus, inerted }
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function isDialogOpen() {
    return !!dialog && !isHidden(dialog.overlay);
  }

  function openSuccessDialog(returnFocus) {
    if (!dialog) {
      // The dialog has been removed from the page: show the thank-you page instead.
      window.location.assign('/thanks.html');
      return;
    }
    dialog.returnFocus = returnFocus || document.activeElement;
    // Everything behind the dialog is made inert so it cannot be clicked or tabbed to.
    dialog.inerted = [];
    forEachNode(document.body.children, function (child) {
      if (child === dialog.overlay || child.tagName === 'SCRIPT' || child.hasAttribute('inert')) {
        return;
      }
      child.setAttribute('inert', '');
      dialog.inerted.push(child);
    });
    document.body.classList.add('overflow-hidden');
    setHidden(dialog.overlay, false);
    focusQuietly(dialog.box);
  }

  function closeSuccessDialog(restoreFocus) {
    if (!isDialogOpen()) {
      return;
    }
    setHidden(dialog.overlay, true);
    document.body.classList.remove('overflow-hidden');
    dialog.inerted.forEach(function (node) {
      node.removeAttribute('inert');
    });
    dialog.inerted = [];
    var target = dialog.returnFocus;
    dialog.returnFocus = null;
    if (restoreFocus && target && document.body.contains(target) && typeof target.focus === 'function') {
      target.focus();
    }
  }

  // Keeps Tab and Shift+Tab inside the dialog while it is open.
  function keepFocusInside(event) {
    var nodes = Array.prototype.filter.call(dialog.box.querySelectorAll(FOCUSABLE), function (node) {
      return !isHidden(node);
    });
    if (!nodes.length) {
      event.preventDefault();
      focusQuietly(dialog.box);
      return;
    }
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    var active = document.activeElement;
    if (!dialog.box.contains(active)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && (active === first || active === dialog.box)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function initSuccessDialog() {
    var overlay = byId('success-modal');
    var box = overlay ? overlay.querySelector('[role="dialog"]') : null;
    if (!overlay || !box) {
      return;
    }
    dialog = { overlay: overlay, box: box, returnFocus: null, inerted: [] };

    overlay.addEventListener('click', function (event) {
      var target = event.target;
      if (target === overlay) {
        closeSuccessDialog(true); // a click on the dimmed background
        return;
      }
      if (!target || !target.closest) {
        return;
      }
      if (target.closest('[data-modal-close]')) {
        closeSuccessDialog(true);
      } else if (target.closest('a[href^="#"]')) {
        closeSuccessDialog(false); // e.g. "More places to get urgent help": let the link move the page
      }
    });

    document.addEventListener('keydown', function (event) {
      if (!isDialogOpen()) {
        return;
      }
      if (isEscape(event)) {
        event.preventDefault();
        closeSuccessDialog(true);
      } else if (event.key === 'Tab') {
        keepFocusInside(event);
      }
    });
  }


  /* ------------------------------------------------------------------
   * 10. Service buttons on the price cards
   *     "Enquire about ..." links carry data-service="..." matching a value in the form's
   *     service list, and pick that option on the way down to the form.
   * ------------------------------------------------------------------ */

  function initServiceLinks() {
    var select = byId('cf-service');
    if (!select) {
      return;
    }
    forEachNode(document.querySelectorAll('a[data-service]'), function (link) {
      link.addEventListener('click', function () {
        var wanted = link.getAttribute('data-service');
        for (var i = 0; i < select.options.length; i++) {
          if (select.options[i].value === wanted) {
            select.value = wanted;
            clearFieldError('service');
            return;
          }
        }
      });
    });
  }


  /* ------------------------------------------------------------------
   * 11. Start-up
   *     Each part starts on its own, so a problem in one cannot stop the others.
   * ------------------------------------------------------------------ */

  function safely(part) {
    try {
      return part();
    } catch (error) {
      if (window.console && typeof window.console.error === 'function') {
        window.console.error('site.js:', error);
      }
      return false;
    }
  }

  function start() {
    safely(initMobileMenu);

    // The questionnaires only appear once their questions have been drawn.
    var drawn = false;
    QUESTIONNAIRE_KEYS.forEach(function (key) {
      if (safely(function () { return initQuestionnaire(key); })) {
        drawn = true;
      }
    });
    if (drawn) {
      safely(initTabs);
      setHidden(byId('selfcheck'), false);
    }

    safely(initAddButtons);
    safely(initContactForm);
    safely(initSuccessDialog);
    safely(initServiceLinks);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
