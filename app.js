(function () {
  'use strict';

  var OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var MAX_OPTIONS = OPTION_LETTERS.length;
  var REVIEW_MODE_IMMEDIATE = 'immediate';
  var REVIEW_MODE_AFTER_ALL = 'afterAll';

  var dom = {
    startScreen: document.getElementById('start-screen'),
    quizScreen: document.getElementById('quiz-screen'),
    resultScreen: document.getElementById('result-screen'),
    chooseBankButton: document.getElementById('choose-bank'),
    bankFileInput: document.getElementById('bank-file'),
    fileDisplay: document.getElementById('file-display'),
    startError: document.getElementById('start-error'),
    bankTitle: document.getElementById('bank-title'),
    timer: document.getElementById('timer'),
    timeLimit: document.getElementById('time-limit'),
    progress: document.getElementById('progress'),
    score: document.getElementById('score'),
    questionType: document.getElementById('question-type'),
    questionText: document.getElementById('question-text'),
    optionsLegend: document.getElementById('options-legend'),
    optionsList: document.getElementById('options-list'),
    feedback: document.getElementById('feedback'),
    prevButton: document.getElementById('prev-button'),
    actionButton: document.getElementById('action-button'),
    finishButton: document.getElementById('finish-button'),
    resultTitle: document.getElementById('result-title'),
    resultBank: document.getElementById('result-bank'),
    resultScore: document.getElementById('result-score'),
    resultDetail: document.getElementById('result-detail'),
    wrongList: document.getElementById('wrong-list'),
    correctList: document.getElementById('correct-list'),
    retryButton: document.getElementById('retry-button'),
    changeBankButton: document.getElementById('change-bank-button'),
    statusbarText: document.getElementById('statusbar-text')
  };

  var state = {
    bank: null,
    fileName: '',
    currentIndex: 0,
    selections: [],
    results: [],
    correctCount: 0,
    timerStartedAt: 0
  };

  var timerIntervalId = null;

  function BankError(message) {
    this.name = 'BankError';
    this.message = message;
  }
  BankError.prototype = Object.create(Error.prototype);
  BankError.prototype.constructor = BankError;

  function setStatus(message) {
    dom.statusbarText.textContent = message;
  }

  function showScreen(name) {
    dom.startScreen.hidden = name !== 'start';
    dom.quizScreen.hidden = name !== 'quiz';
    dom.resultScreen.hidden = name !== 'result';
  }

  function showError(message) {
    dom.startError.textContent = message;
    dom.startError.hidden = false;
  }

  function clearError() {
    dom.startError.textContent = '';
    dom.startError.hidden = true;
  }

  function showStartScreen() {
    stopQuizTimer();
    state.bank = null;
    state.fileName = '';
    state.currentIndex = 0;
    state.selections = [];
    state.results = [];
    state.correctCount = 0;
    state.timerStartedAt = 0;

    dom.fileDisplay.textContent = '未选择题库文件';
    dom.bankFileInput.value = '';
    dom.finishButton.hidden = true;
    dom.finishButton.disabled = true;
    resetTimerDisplay();
    clearError();
    showScreen('start');
    setStatus('就绪');
  }

  function fallbackTitle(fileName) {
    var withoutExtension = fileName.replace(/\.json$/i, '').trim();
    return withoutExtension || '未命名题库';
  }

  function normalizeBank(raw, fileName) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BankError('题库根节点必须是一个 JSON 对象。');
    }

    if (raw.title !== undefined && typeof raw.title !== 'string') {
      throw new BankError('题库的 title 必须是字符串。');
    }

    var reviewMode = REVIEW_MODE_IMMEDIATE;
    if (raw.reviewMode !== undefined) {
      if (raw.reviewMode !== REVIEW_MODE_IMMEDIATE && raw.reviewMode !== REVIEW_MODE_AFTER_ALL) {
        throw new BankError('题库的 reviewMode 必须是 "immediate" 或 "afterAll"。');
      }
      reviewMode = raw.reviewMode;
    }

    var timeLimitSeconds = normalizeTimeLimit(raw.timeLimit);

    if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
      throw new BankError('题库必须包含一个非空的 questions 数组。');
    }

    var title = typeof raw.title === 'string' ? raw.title.trim() : '';
    var questions = raw.questions.map(function (rawQuestion, questionIndex) {
      var label = '第 ' + (questionIndex + 1) + ' 题';

      if (!rawQuestion || typeof rawQuestion !== 'object' || Array.isArray(rawQuestion)) {
        throw new BankError(label + '必须是一个对象。');
      }

      if (typeof rawQuestion.question !== 'string' || !rawQuestion.question.trim()) {
        throw new BankError(label + '的 question 不能为空。');
      }

      if (!Array.isArray(rawQuestion.options) ||
          rawQuestion.options.length < 2 ||
          rawQuestion.options.length > MAX_OPTIONS) {
        throw new BankError(label + '的 options 必须是 2–' + MAX_OPTIONS + ' 个选项的数组。');
      }

      var options = rawQuestion.options.map(function (option, optionIndex) {
        if (typeof option !== 'string' || !option.trim()) {
          throw new BankError(label + '的第 ' + (optionIndex + 1) + ' 个选项不能为空。');
        }
        return option.trim();
      });

      var answerData = normalizeAnswer(rawQuestion.answer, options.length, label);

      var explanation = null;
      if (rawQuestion.explanation !== undefined) {
        if (typeof rawQuestion.explanation !== 'string') {
          throw new BankError(label + '的 explanation 必须是字符串。');
        }
        explanation = rawQuestion.explanation.trim() || null;
      }

      return {
        prompt: rawQuestion.question.trim(),
        options: options,
        answer: answerData.indexes,
        isMultiple: answerData.isMultiple,
        explanation: explanation
      };
    });

    return {
      title: title || fallbackTitle(fileName),
      reviewMode: reviewMode,
      timeLimitSeconds: timeLimitSeconds,
      questions: questions
    };
  }

  function normalizeTimeLimit(rawTimeLimit) {
    if (rawTimeLimit === undefined || rawTimeLimit === null) {
      return null;
    }

    if (typeof rawTimeLimit !== 'string') {
      throw new BankError('题库的 timeLimit（时间限制）必须使用 "时:分:秒" 格式的字符串。');
    }

    var text = rawTimeLimit.trim();
    if (!text) {
      return null;
    }

    var match = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(text);
    if (!match) {
      throw new BankError('题库的 timeLimit（时间限制）必须使用 "时:分:秒" 格式，例如 "00:30:00"。');
    }

    var seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    if (!Number.isSafeInteger(seconds)) {
      throw new BankError('题库的 timeLimit（时间限制）数值过大。');
    }

    return seconds;
  }

  function normalizeAnswer(rawAnswer, optionCount, label) {
    var isMultiple;
    var answerValues;

    if (typeof rawAnswer === 'string') {
      isMultiple = false;
      answerValues = [rawAnswer];
    } else if (Array.isArray(rawAnswer)) {
      isMultiple = true;
      answerValues = rawAnswer;
    } else {
      throw new BankError(label + '的 answer 必须是单个字母，或多选答案字母数组。');
    }

    if (answerValues.length === 0) {
      throw new BankError(label + '的 answer 不能为空。');
    }

    var seen = {};
    answerValues.forEach(function (value) {
      if (typeof value !== 'string' || !/^[A-Za-z]$/.test(value.trim())) {
        throw new BankError(label + '的 answer 包含无效值，必须是 A–Z 中的单个字母。');
      }

      var letter = value.trim().toUpperCase();
      var index = letter.charCodeAt(0) - 65;

      if (index >= optionCount) {
        throw new BankError(label + '的 answer 引用了不存在的选项 “' + letter + '”。');
      }

      if (seen[index]) {
        throw new BankError(label + '的 answer 包含重复字母 “' + letter + '”。');
      }
      seen[index] = true;
    });

    var indexes = Object.keys(seen).map(Number).sort(function (a, b) {
      return a - b;
    });

    return {
      indexes: indexes,
      isMultiple: isMultiple
    };
  }

  function isAfterAllMode() {
    return state.bank && state.bank.reviewMode === REVIEW_MODE_AFTER_ALL;
  }

  function currentQuestion() {
    return state.bank.questions[state.currentIndex];
  }

  function isLastQuestion() {
    return state.currentIndex === state.bank.questions.length - 1;
  }

  function getSelection(index) {
    return state.selections[index] || [];
  }

  function hasSelection(index) {
    return getSelection(index).length > 0;
  }

  function getResult(index) {
    return state.results[index] || null;
  }

  function isGraded(index) {
    return getResult(index) !== null;
  }

  function answeredCount() {
    return state.selections.reduce(function (count, selection) {
      return count + (selection && selection.length > 0 ? 1 : 0);
    }, 0);
  }

  function allAnswered() {
    return state.bank.questions.every(function (question, index) {
      return hasSelection(index);
    });
  }

  function formatDuration(totalSeconds) {
    var seconds = Math.max(0, Math.floor(totalSeconds));
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    var remainder = seconds % 60;

    return String(hours).padStart(2, '0') + ':' +
      String(minutes).padStart(2, '0') + ':' +
      String(remainder).padStart(2, '0');
  }

  function updateTimer() {
    if (!state.bank || state.timerStartedAt === 0) {
      return;
    }

    var elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.timerStartedAt) / 1000));
    var isOverLimit = state.bank.timeLimitSeconds !== null &&
      elapsedSeconds > state.bank.timeLimitSeconds;
    var display = formatDuration(elapsedSeconds);

    dom.timer.textContent = display;
    dom.timer.classList.toggle('is-over-limit', isOverLimit);
    dom.timer.setAttribute(
      'aria-label',
      '答题用时 ' + display + (isOverLimit ? '，已超过时间限制' : '')
    );
  }

  function stopQuizTimer() {
    if (timerIntervalId !== null) {
      window.clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  function resetTimerDisplay() {
    dom.timer.textContent = '00:00:00';
    dom.timer.classList.remove('is-over-limit');
    dom.timer.setAttribute('aria-label', '答题用时 00:00:00');
    dom.timeLimit.textContent = '';
    dom.timeLimit.hidden = true;
  }

  function startQuizTimer(bank) {
    stopQuizTimer();
    state.timerStartedAt = Date.now();
    resetTimerDisplay();

    if (bank.timeLimitSeconds !== null) {
      dom.timeLimit.textContent = '时间限制：' + formatDuration(bank.timeLimitSeconds);
      dom.timeLimit.hidden = false;
    }

    updateTimer();
    timerIntervalId = window.setInterval(updateTimer, 1000);
  }

  function beginQuiz(bank, fileName) {
    state.bank = bank;
    state.fileName = fileName;
    state.currentIndex = 0;
    state.selections = bank.questions.map(function () {
      return [];
    });
    state.results = bank.questions.map(function () {
      return null;
    });
    state.correctCount = 0;

    startQuizTimer(bank);
    showScreen('quiz');
    renderQuestion();
  }

  function buildOption(question, optionText, optionIndex, selection, locked) {
    var label = document.createElement('label');
    label.className = 'option';

    var input = document.createElement('input');
    input.type = question.isMultiple ? 'checkbox' : 'radio';
    input.name = 'quiz-answer';
    input.value = String(optionIndex);
    input.checked = selection.indexOf(optionIndex) !== -1;
    input.disabled = locked;
    input.addEventListener('change', handleOptionChange);

    var text = document.createElement('span');
    text.className = 'option-text';

    var letter = document.createElement('span');
    letter.className = 'option-letter';
    letter.textContent = OPTION_LETTERS[optionIndex] + '.';

    text.appendChild(letter);
    text.appendChild(document.createTextNode(' ' + optionText));
    label.appendChild(input);
    label.appendChild(text);

    if (locked) {
      label.classList.add('is-locked');
    }

    return label;
  }

  function updateScore() {
    if (!state.bank) {
      return;
    }

    if (isAfterAllMode()) {
      dom.score.textContent = '已答 ' + answeredCount() + ' / ' + state.bank.questions.length + ' 题';
    } else {
      dom.score.textContent = '答对 ' + state.correctCount + ' 题';
    }
  }

  function updateActionButton() {
    if (!state.bank) {
      return;
    }

    var afterAll = isAfterAllMode();
    var graded = !afterAll && isGraded(state.currentIndex);

    dom.prevButton.disabled = state.currentIndex === 0;
    dom.finishButton.hidden = !afterAll;
    dom.finishButton.disabled = !allAnswered();

    if (afterAll) {
      dom.actionButton.textContent = '下一题';
      dom.actionButton.disabled = isLastQuestion();
      return;
    }

    if (graded) {
      dom.actionButton.textContent = isLastQuestion() ? '查看结果' : '下一题';
      dom.actionButton.disabled = false;
      return;
    }

    dom.actionButton.textContent = '提交答案';
    dom.actionButton.disabled = !hasSelection(state.currentIndex);
  }

  function updateAfterAllStatus() {
    if (allAnswered()) {
      setStatus('全部题目已作答，可以查看结果。');
    } else {
      setStatus('已答 ' + answeredCount() + ' / ' + state.bank.questions.length +
        ' 题；全部答完后可查看答案。');
    }
  }

  function updateQuestionStatus() {
    if (isAfterAllMode()) {
      updateAfterAllStatus();
      return;
    }

    if (isGraded(state.currentIndex)) {
      setStatus(getResult(state.currentIndex).correct ? '本题回答正确。' : '本题回答错误。');
      return;
    }

    setStatus('请选择答案后提交。');
  }

  function renderQuestion() {
    var bank = state.bank;
    var question = currentQuestion();
    var selection = getSelection(state.currentIndex);
    var afterAll = isAfterAllMode();
    var graded = !afterAll && isGraded(state.currentIndex);

    dom.bankTitle.textContent = bank.title;
    dom.progress.textContent = '第 ' + (state.currentIndex + 1) + ' / ' + bank.questions.length + ' 题';
    dom.questionType.textContent = question.isMultiple ?
      '多选题 · 请选择所有正确项' :
      '单选题 · 请选择一项';
    dom.questionText.textContent = question.prompt;
    dom.optionsLegend.textContent = question.isMultiple ?
      '多选题选项，请选择所有正确项' :
      '单选题选项，请选择一项';

    dom.optionsList.replaceChildren();
    question.options.forEach(function (optionText, optionIndex) {
      dom.optionsList.appendChild(buildOption(
        question,
        optionText,
        optionIndex,
        selection,
        graded
      ));
    });

    dom.feedback.hidden = true;
    dom.feedback.className = 'feedback';
    dom.feedback.replaceChildren();

    if (graded) {
      markOptions(question, selection);
      renderFeedback(question, selection, getResult(state.currentIndex).correct);
    }

    updateScore();
    updateActionButton();
    updateQuestionStatus();
    dom.questionText.focus();
  }

  function selectedIndexes() {
    return Array.prototype.slice
      .call(dom.optionsList.querySelectorAll('input:checked'))
      .map(function (input) {
        return Number(input.value);
      })
      .sort(function (a, b) {
        return a - b;
      });
  }

  function handleOptionChange() {
    if (!state.bank) {
      return;
    }

    state.selections[state.currentIndex] = selectedIndexes();
    updateScore();
    updateActionButton();

    if (isAfterAllMode()) {
      updateAfterAllStatus();
    } else if (!isGraded(state.currentIndex) && hasSelection(state.currentIndex)) {
      setStatus('已选择答案，请提交。');
    }
  }

  function formatAnswer(indexes) {
    return indexes.map(function (index) {
      return OPTION_LETTERS[index];
    }).join('、');
  }

  function sameAnswer(left, right) {
    return left.length === right.length && left.every(function (value, index) {
      return value === right[index];
    });
  }

  function markOptions(question, selected) {
    Array.prototype.slice.call(dom.optionsList.children).forEach(function (label, index) {
      var input = label.querySelector('input');
      var text = label.querySelector('.option-text');
      var isCorrectOption = question.answer.indexOf(index) !== -1;
      var isSelected = selected.indexOf(index) !== -1;
      var notes = [];

      input.disabled = true;
      label.classList.add('is-locked');

      if (isCorrectOption) {
        label.classList.add('is-correct');
        notes.push('正确答案');
      } else if (isSelected) {
        label.classList.add('is-wrong');
      }

      if (isSelected) {
        notes.push('你的选择');
      }

      if (notes.length > 0) {
        var note = document.createElement('span');
        note.className = 'option-note';
        note.textContent = '（' + notes.join('，') + '）';
        text.appendChild(note);
      }
    });
  }

  function renderFeedback(question, selected, isCorrect) {
    var verdict = document.createElement('p');
    verdict.className = 'feedback-verdict';
    verdict.textContent = isCorrect ? '回答正确。' : '回答错误。';

    var answerLine = document.createElement('p');
    answerLine.className = 'feedback-answer';
    answerLine.textContent = '你的答案：' + formatAnswer(selected) +
      '；正确答案：' + formatAnswer(question.answer) + '。';

    dom.feedback.replaceChildren(verdict, answerLine);

    if (question.explanation) {
      var explanation = document.createElement('p');
      explanation.className = 'feedback-explanation';
      explanation.textContent = '解析：' + question.explanation;
      dom.feedback.appendChild(explanation);
    }

    dom.feedback.className = 'feedback ' + (isCorrect ? 'is-correct' : 'is-wrong');
    dom.feedback.hidden = false;
  }

  function submitAnswer() {
    if (!state.bank || isAfterAllMode() || isGraded(state.currentIndex)) {
      return;
    }

    var selected = selectedIndexes();
    if (selected.length === 0) {
      setStatus('请先选择答案。');
      return;
    }

    var question = currentQuestion();
    var isCorrect = sameAnswer(selected, question.answer);

    state.selections[state.currentIndex] = selected;
    state.results[state.currentIndex] = {
      correct: isCorrect
    };

    if (isCorrect) {
      state.correctCount += 1;
    }

    markOptions(question, selected);
    renderFeedback(question, selected, isCorrect);
    updateScore();
    updateActionButton();
    setStatus(isCorrect ? '本题回答正确。' : '本题回答错误。');
  }

  function saveCurrentSelection() {
    if (!state.bank || (!isAfterAllMode() && isGraded(state.currentIndex))) {
      return;
    }
    state.selections[state.currentIndex] = selectedIndexes();
  }

  function goToQuestion(index) {
    saveCurrentSelection();
    state.currentIndex = index;
    renderQuestion();
  }

  function goPrevious() {
    if (!state.bank || state.currentIndex === 0) {
      return;
    }
    goToQuestion(state.currentIndex - 1);
  }

  function goNext() {
    if (!state.bank || isLastQuestion()) {
      return;
    }
    goToQuestion(state.currentIndex + 1);
  }

  function handleAction() {
    if (!state.bank) {
      return;
    }

    if (isAfterAllMode()) {
      goNext();
      return;
    }

    if (isGraded(state.currentIndex)) {
      if (isLastQuestion()) {
        renderResults();
      } else {
        goNext();
      }
      return;
    }

    submitAnswer();
  }

  function gradeAllQuestions() {
    var correctCount = 0;

    state.results = state.bank.questions.map(function (question, index) {
      var isCorrect = sameAnswer(getSelection(index), question.answer);
      if (isCorrect) {
        correctCount += 1;
      }
      return {
        correct: isCorrect
      };
    });

    state.correctCount = correctCount;
  }

  function finishAfterAllQuiz() {
    if (!isAfterAllMode() || !allAnswered()) {
      return;
    }

    gradeAllQuestions();
    renderResults();
  }

  function appendResultLine(className, text) {
    var element = document.createElement('p');
    element.className = className;
    element.textContent = text;
    return element;
  }

  function buildReviewItem(question, selected, index) {
    var item = document.createElement('article');
    item.className = 'review-item';

    item.appendChild(appendResultLine(
      'review-question',
      '第 ' + (index + 1) + ' 题：' + question.prompt
    ));
    item.appendChild(appendResultLine(
      'review-answer',
      '你的答案：' + formatAnswer(selected) +
        '；正确答案：' + formatAnswer(question.answer) + '。'
    ));
    item.appendChild(appendResultLine(
      'review-explanation',
      question.explanation ? '解析：' + question.explanation : '解析：题库未提供解析。'
    ));

    return item;
  }

  function appendEmptyNote(container, text) {
    container.appendChild(appendResultLine('empty-note', text));
  }

  function renderReviewLists() {
    dom.wrongList.replaceChildren();
    dom.correctList.replaceChildren();

    var wrongCount = 0;
    var correctCount = 0;

    state.bank.questions.forEach(function (question, index) {
      var result = getResult(index);
      if (!result) {
        return;
      }

      var item = buildReviewItem(question, getSelection(index), index);

      if (result.correct) {
        correctCount += 1;
        dom.correctList.appendChild(item);
      } else {
        wrongCount += 1;
        dom.wrongList.appendChild(item);
      }
    });

    if (wrongCount === 0) {
      appendEmptyNote(dom.wrongList, '无错题。');
    }
    if (correctCount === 0) {
      appendEmptyNote(dom.correctList, '无正确题目。');
    }
  }

  function renderResults() {
    var bank = state.bank;
    var total = bank.questions.length;
    var percentage = Math.round((state.correctCount / total) * 100);

    stopQuizTimer();
    showScreen('result');

    dom.resultBank.textContent = bank.title;
    dom.resultScore.textContent = '答对 ' + state.correctCount + ' / ' + total + ' 题';
    dom.resultDetail.textContent = '正确率 ' + percentage + '%。';
    renderReviewLists();

    setStatus('答题结束：答对 ' + state.correctCount + ' / ' + total + ' 题。');
    dom.resultTitle.focus();
  }

  function retryQuiz() {
    if (!state.bank) {
      showStartScreen();
      return;
    }

    var bank = state.bank;
    var fileName = state.fileName;
    beginQuiz(bank, fileName);
  }

  function handleFileSelection(event) {
    var input = event.currentTarget;
    var file = input.files && input.files[0];
    if (!file) {
      return;
    }

    var fileName = file.name;
    dom.fileDisplay.textContent = fileName;
    dom.chooseBankButton.disabled = true;
    clearError();
    setStatus('正在读取题库…');

    file.text()
      .then(function (text) {
        var raw;
        try {
          raw = JSON.parse(text.replace(/^\uFEFF/, ''));
        } catch (error) {
          throw new BankError('JSON 语法错误，无法解析题库文件。');
        }

        var bank = normalizeBank(raw, fileName);
        beginQuiz(bank, fileName);
      })
      .catch(function (error) {
        showStartScreen();
        dom.fileDisplay.textContent = fileName;

        if (error instanceof BankError) {
          showError(error.message);
        } else {
          showError('无法读取题库文件，请确认文件存在且内容为 UTF-8 编码。');
        }
        setStatus('题库加载失败。');
      })
      .finally(function () {
        input.value = '';
        dom.chooseBankButton.disabled = false;
      });
  }

  dom.chooseBankButton.addEventListener('click', function () {
    dom.bankFileInput.click();
  });

  dom.bankFileInput.addEventListener('change', handleFileSelection);
  dom.prevButton.addEventListener('click', goPrevious);
  dom.actionButton.addEventListener('click', handleAction);
  dom.finishButton.addEventListener('click', finishAfterAllQuiz);
  dom.retryButton.addEventListener('click', retryQuiz);
  dom.changeBankButton.addEventListener('click', showStartScreen);

  showStartScreen();
})();
