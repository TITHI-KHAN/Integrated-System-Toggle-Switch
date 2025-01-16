// content.js - modifies and adds behaviors to active tab page

(function main() {
  
  // These variables store the original and replaced sentences
  var originalSentences = {};
  var markedUpSentences = {};
  var replacedSentences = null;

  // Extension settings
  var extensionSettings = {}

  /***
   * Inserting a Firebase URL with this format: https://your-firebase.firebaseio.com/fireblog/{path}.json
   * will create logs of the users' requests and interactions.
   * {path} will be replaced by the code to create directories in Firebase for the various types of logs.
   */
  let FIREBASE_URL = '';

  // This variable needs to match the same variable on popup.js, as that's where the extension settings are stored
  let CHROME_STORAGE_VAR = "atsp_settings";

  // Identify page main content
  const mainContent = identifyPageMainContent();
  mainContent.classList.add("document");
  mainContent.setAttribute("id", "document0");


  // Get all paragraphs within the main content of the page
  const paragraphs = mainContent.querySelectorAll("p");
  var wordIndex = 0; 
  var sentenceIndex = 0;

  // Add the class paragraph and IDs to all paragraph tags in the page
  for (var i = 0; i < paragraphs.length; i++) {
    let paragraph = paragraphs[i];
    paragraph.classList.add("paragraph");
    paragraph.setAttribute("id", `paragraph${i}`);
    
    /***
     * These function call identifies all the text in the main content and builds up
     * the current sentence variables (i.e. originalSentences), assigns IDs to all sentences
     * and wraps all words in spans.
     */
    words = identifyWords(paragraph);
    identifySentences(words);
    paragraph.innerHTML = words.join(" "); 
  }

  /***
   * Once the call to identifyWords above has added IDs to all sentences and wrapped words in spans, 
   * store all marked up sentences.
   */
  document.querySelectorAll('[id*="sentence"]').forEach(function(sentence) {
    markedUpSentences[sentence.id] = sentence.innerHTML;
  });

  // Send message to background.js with collected sentences
  chrome.runtime.sendMessage({
    from: "content",
    toSimplify: originalSentences
  });


  // Check for existing stored extension settings to adjust the content to those settings
  chrome.storage.sync.get(CHROME_STORAGE_VAR, function (status) {
    switchingSetting(status[CHROME_STORAGE_VAR], true);
  });


  /***
   * This is triggered by popup.js OR background.js using chrome.runtime.sendMessage
   * If the event came from popup.js, then we log a setting switch
   * If it comes from the API, we updated the replacedSentences and mark up complex text
   * to add the functionality to replace it.
   */
  chrome.runtime.onMessage.addListener(function(request) {
    if (request.from === "extension") {
      switchingSetting(request.settings, request.resets);
    } 
    
    else if (request.from === "API") {
      if (request.textType === "sentence") {
        replacedSentences = JSON.parse(request.toChange);
        replacedSentences.forEach(sentence => {
          sentence.text = JSON.parse(sentence.text);
        });

        markupComplexWords();
        markupComplexText();
      }
    }
  });


  

  /*
  ––––––––––––––––––––––––––––––––––––––––––––––––––––
  HELPER FUNCTIONS
  ––––––––––––––––––––––––––––––––––––––––––––––––––––
  */



  /**
   * This function identifies the element most likely to contain the text in a page.
   * It uses the text density (i.e. the ratio of text to HTML elements) and the number 
   * of paragraphs (i.e. p tags), then identifies the element with the highest amount 
   * of paragraph density.
   * @returns the element with the highest paragraph density, or the body element as a backup
   */
  
  function identifyPageMainContent() {
    const allElements = Array.from(document.body.getElementsByTagName('*'));

    let bestElement = null;
    let highestParagraphDensity = 0;

    allElements.forEach(element => {
      const paragraphCount = element.querySelectorAll('p').length;
      const textDensity = calculateTextDensity(element);
      const paragraphDensity = paragraphCount * textDensity;

      // Update the best element if it has more paragraphs and higher text density
      if (paragraphDensity > highestParagraphDensity) {

        highestParagraphDensity = paragraphDensity;
        bestElement = element;
      }
    });

    return bestElement ? bestElement : document.querySelector("body");
  }

  /**
   * Calculates the text density defined as the ratio of text to HTML content
   * @param {*} element HTML element to calculate the density for
   * @returns a fraction representing the text density of element
   */
  function calculateTextDensity(element) {
    const textContent = element.innerText;
    const HTMLContent = element.innerHTML;
    try {
      return textContent.length / HTMLContent.length;
    } catch (error) {
      return 0;
    }

  }




  /**
   * Goes through all words in a paragraph, splits them while preserving HTML tags together
   * Then wraps each word in a span and puts the wrapped words in a list
   * @param {*} node paragraph element to identify words in
   * @returns a list of words wrapped in spans all with IDs
   */
  function identifyWords(node) {
    if (node.parentNode && node.parentNode.nodeName === "TEXTAREA") {
      return;
    }

    let currText;
    if (node.childNodes.length == 1) {
      currText = node.innerHTML.split(" ");
    } else {
      currText = [];
      Array.from(node.childNodes).forEach((child, i) => {
        let childText;
        if (child.outerHTML) {
          childText = child.outerHTML.match(/<[^>]*>|[^\s<]+/g);
        } else {
          childText = child.textContent.split(" ");
        }
        currText.push(...childText);
      });
    }

    var words = currText.map((word) => {
      let wordsWithID = tagWords(word);
      return wordsWithID;
    });

    return words;
  }

  /**
   * Takes all words and wraps them in a span to prepare them for adding functionality later on
   * @param {*} word the word to wrap in a span
   * @returns a word wrapped in a span, unless it's a link
   */
  function tagWords(word) {

    // remove any tags from the word from the word that isn't purely the text itself - for instance, "<b>word</b>" should become "word"
    let cleanWord = word.replace(/\<(.*?)\>/g, "");

    matchInd = word.indexOf(cleanWord);

    if (cleanWord === "") {
      return word;
    }

    if (!cleanWord.includes("http")) {
      let id = "word" + wordIndex;
      tagged = `<span id=${id}>${cleanWord}</span>`;
      freshHTML =
        word.substring(0, matchInd) +
        tagged +
        word.substring(matchInd + cleanWord.length, word.length);
      ++wordIndex;
      return freshHTML;
    } else {
      return word;
    }
  }

  
  /**
   * Identifies all sentences based on a sequential list of words and wraps the sentences in a span with an ID
   * @param {*} words list of words to base the sentencens on
   */
  function identifySentences(words) {
    // These are common abbreviations to avoid splitting sentences at; can add more
    const abbreviationsToAvoid = ["Dr.", "Mr.", "Mrs.", "Ms.", "No.", "Ph.D."];

    var sentenceEndIndices = [];

    // get indices for any text that includes a ending character ---> [? . !]
    words.forEach(function (word, index) {
      const cleanWord = makeCleanText(word);
      var re = '(.[.?!])|([.?!]\")';
      let match = cleanWord.slice(-2).match(re) && !abbreviationsToAvoid.includes(cleanWord);
      if (match && cleanWord.length > 2) {
        sentenceEndIndices.push(index);
      }
    });

    var currEndInd = 0;
    var sentenceStart = {};
    var nextTextInd = 0;
    var sentence = [];
    var id = null;

    // loop over words list
    words.forEach(function (text, index) {
      sentence.push(text);

      if (index === 0) {
        let id = "sentence" + sentenceIndex;
        sentenceStart[0] = "<span class=\"sentence\" id=" + id + ">" + text;
        sentenceIndex++;
      } else if (index === sentenceEndIndices[currEndInd]) {
        this[index] = text + "</span>";
        currEndInd++;
        startVals = Object.entries(sentenceStart)[0];
        this[startVals[0]] = startVals[1];

        let cleanSentence = makeCleanText(sentence.join(" "));
        cleanSentence = cleanSentence.replace(/\s+/g, " ");

        let id = "sentence" + (sentenceIndex - 1);
        originalSentences[id] = cleanSentence;

        sentenceStart = {};
        nextTextInd = index + 1;
        if (this[nextTextInd] != null) {
          id = "sentence" + (sentenceIndex);
          sentenceStart[nextTextInd] =
            "<span class=\"sentence\" id=" + id + "> " + this[nextTextInd];
          sentenceIndex++;
        }

        sentence = [];
      }

    }, words);
  }





  /**
   * This function is called every time a setting is switched to update the content appropriately
   * @param {*} new_settings the updated settings
   * @param {*} updated which setting was last updated
   * @param {*} resets whether the changes should be reverted
   */
  function switchingSetting(new_settings, resets) {
    if (resets) clearTextMarkup();

    extensionSettings = new_settings;

    if (resets) {
      markupComplexText(revertContentToOriginal);
    }

    toggleHighlightSettings();
  }

  /**
   * Removes any existing markup (e.g. existing simplifications) and listeners
   */
  function clearTextMarkup() {
    removeToolTips();
    removeSideTips();
    toggleListeners("remove");
    toggleSwappedClass(false);
    toggleHighlightSettings(false);
  }

  /**
   * Toggles both highlight settings (i.e. for complex and replaced)
   * @param {*} value optional parameter to force a specific value
   */
  function toggleHighlightSettings(value = null) {
    toggleHighlightSetting("highlightComplexToggle", value);
    toggleHighlightSetting("highlightReplacedToggle", value);
  }

  /**
   * Adds or remove the class to add highlights to the relevant text
   * @param {*} setting which setting is being toggled (e.g. complex or replaced)
   * @param {*} value optional parameter to force a specific value instead of toggling
   */
  function toggleHighlightSetting(setting, value = null) {
    var value = value === null ? extensionSettings[setting] : value;

    const body = document.querySelector("body");
    const highlightClass = getHighighlightClass(setting);

    if (value && extensionSettings["enabled"]) {
      body.classList.add(highlightClass);
    } else {
      body.classList.remove(highlightClass);
    }
  }

  /**
   * Helper function that generates the highlight class for a setting (e.g. complex or replaced)
   * The CSS file will use the class generated by this function to style the appropriate text
   * @param {*} setting which seting this is for (e.g. complex or replaced)
   * @returns the class name for that highlight setting
   */
  function getHighighlightClass(setting) {
    const highlightType = extensionSettings["simpSetting"] == "lexical" ? "words" : "sentences";
    return setting + "-" + highlightType;
  }


  /**
   * Goes through all text (based on quantity) and marks up as complex if there's a simplification available
   * @param {*} revertToOriginal optional parameter for whether the text is being reverted to its original version
   * before marking up again
   */
  function markupComplexText(revertToOriginal = true) {
    if (revertToOriginal) {
      revertContentToOriginal();
    }
    const sentences = document.querySelectorAll('[id*="sentence"]');

    sentences.forEach(function (sentence) {
      try {
        let replacements = replacedSentences.find(({
          sentenceID
        }) => sentenceID === sentence.id).text;
        let replacement_sentences = replacements[extensionSettings["simpSetting"]];
        let replacement_words = replacements["words"];

        if (typeof (replacement_sentences) === "object" && Object.keys(replacement_sentences).length === 0) {
          return;
        } else if (replacement_sentences) {
          sentence.classList.add("complex-sentence");
          sentence.closest("p").classList.add("complex-paragraph");
          document.querySelector(".document").classList.add("complex-document");
        }

        Array.from(sentence.children).forEach(function (child) {
          try {
            const word = child.innerText;
            let replacement_word = replacement_words[word]
            if (replacement_word) {
              child.classList.add("complex-word");
            }
          } catch {
            return;
          }

        });

      } catch {
        return;
      }
    });

    toggleListeners("add");
  }

  /**
   * Adds the class complex-word to all words that have a replacement available
   */
  function markupComplexWords() {
    const sentences = document.querySelectorAll('[id*="sentence"]');
    sentences.forEach(function (sentence) {
      try {
        let replacements = replacedSentences.find(({
          sentenceID
        }) => sentenceID === sentence.id).text;
        let replacement_words = replacements["words"];

        Array.from(sentence.children).forEach(function (child) {
          try {
            const word = child.innerText;
            let replacement_word = replacement_words[word]
            if (replacement_word) {
              child.classList.add("complex-word");
            }
          } catch {
            return;
          }

        });

      } catch {
        return;
      }
    });
  }

  /*
   * Wrapper function to revert text to its original version (e.g removing replacements)
   */
  function revertContentToOriginal() {
    const currSentences = document.querySelectorAll('[id*="sentence"]');
    currSentences.forEach(function(sentence) {
      sentence.classList.remove("complex-sentence");
      sentence.innerHTML = markedUpSentences[sentence.id];
    });
  }

  /**
   * Toggles the listeners that add functionality to the complex and replaced text.
   * A lot of hard-coded values correspond to the IDs of the settings' UI (on the HTML file)
   * @param {*} todo whether to add or remove the listeners
   */
  function toggleListeners(todo) {
    try {
      if ("howMuchSetting" in extensionSettings) {
        const className = ".complex-" + extensionSettings["howMuchSetting"].toLowerCase();
        document.querySelectorAll(className).forEach(function (element) {
          let events = [];
          if (extensionSettings["howLongSetting"] == "Temporary") {
            events.push("mouseenter", "mouseleave");
          } else {
            events.push("click");
          }
          events.forEach(function (evt) {
            if (todo === "add" && extensionSettings["enabled"]) {
              element.addEventListener(evt, parseReplacementEvent);
              element.classList.add("clickable-pointer");
            } else if (todo === "remove") {
              element.removeEventListener(evt, parseReplacementEvent);
              element.classList.remove("clickable-pointer");
            }
          });
        });
      } 
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Callback function used for all complex content with fuctionality added by the extension
   * @param {*} event the event object generated by the listener
   */
  function parseReplacementEvent(event) {
    toggleReplacement(event.currentTarget, event.type, event.clientX, event.clientX);
  }

  /**
   * One of the main functions of content.js – toggles (e.g. adds or reverts) replacements when
   * requested. A lot of the values are hard-coded from the extension UI settings (e.g. IDs for 
   * respective elements such as "Temporary" for the duration setting)
   * @param {*} node which text the simplification will be applied or reverted for
   * @param {*} eventType the type of event (e.g. mouseenter or click) which will vary depending on
   * the extension settings
   * @param {*} eventX the x coordinate of the event – where the simplification or revertion was requested
   * @param {*} eventY the y coordinate of the event – where the simplification or revertion was requested
   * @returns 
   */
  function toggleReplacement(node, eventType = null, eventX = null, eventY = null) {
    const tooltips = node.querySelectorAll(".tooltip1");
    const sidetip = document.querySelector(`#sidetip-${node.id}`);
    const swapped = node.classList.contains(getSwappedClassName());

    if (extensionSettings["howLongSetting"] == "Permanent" && swapped) {
      bringTooltipToFront(node, tooltips);
      return;
    }

    if (swapped && eventType != "mouseenter") {
      if (extensionSettings["whereToSetting"] === "Side") {
        var replacement_undone = sidetip.innerText;
      } else if (extensionSettings["howLongSetting"] === "Temporary") {
        var replacement_undone = node.innerText;
      } else {
        var replacement_undone = node.querySelector(".replacement").innerText;
      }

      switch (extensionSettings["whereToSetting"]) {
        case "InPlace":
          removeInPlace(node);
          break;
        case "Popup":
          removeToolTips(tooltips);
          break;
        case "Side":
          removeSideTips(sidetip);
          break;
      }

      toggleSwappedClass(false, node);

      logChange("undoing", node.innerText, replacement_undone, eventX, eventY);
      return;
    }

    let replacement = null;
    const currText = node.innerText;

    if (node.classList.contains("complex-word")) {
      var parentID = node.parentElement.id;
      var simple = replacedSentences.find(({
        sentenceID
      }) => sentenceID === parentID);

      replacement = simple.text["words"][currText];

    } else if (node.classList.contains("complex-sentence")) {
      if (extensionSettings["simpSetting"] == "lexical" && extensionSettings["whereToSetting"] == "InPlace") {
        setChildrenToOtherText(node);
      } else {
        var id = node.id;
        var simple = replacedSentences.find(({
          sentenceID
        }) => sentenceID === id);

        replacement = simple.text[extensionSettings["simpSetting"]];

        if (replacement != "") {
          if (extensionSettings["howMuchSetting"] != "Sentence" && extensionSettings["whereToSetting"] != "InPlace") {
            return replacement + " ";
          }
        }
      }
    } else if (node.classList.contains("complex-paragraph") || node.classList.contains("complex-document")) {
      if (extensionSettings["whereToSetting"] == "InPlace") {
        removeClickablePointerWhenPermanent(node);
        setChildrenToOtherText(node);
      } else {
        replacement = "";
        replacement += setChildrenToOtherText(node);
        if (extensionSettings["howMuchSetting"] == "Document" && node.classList.contains("complex-paragraph")) {
          return replacement + "\n";
        }
      }
    } else if (node.classList.contains("sentence")) {
      return node.innerText + " ";
    }

    if (replacement && eventType != "mouseleave") {
      let original = node.innerText;

      switch (extensionSettings["whereToSetting"]) {
        case "InPlace":
          replaceInPlace(node, replacement);
          removeClickablePointerWhenPermanent(node);
          break;
        case "Popup":
          showToolTip(node, replacement);
          break;
        case "Side":
          showSideTip(node, replacement);
          break;
      }

      toggleSwappedClass(true, node);
      logChange("simplifying", original, replacement, eventX, eventY);
    }
  }





  /*
  ––––––––––––––––––––––––––––––––––––––––––––––––––––
  HELPER FUNCTIONS FOR TOGGLING REPLACEMENTS
  A lot of these functions are hard-coded for the extension 
  settings, using values from the extension UI which are 
  saved as values in the extension settings (e.g. HTML 
  elements' IDs)
  ––––––––––––––––––––––––––––––––––––––––––––––––––––
  */



  /**
   * Helper function for when the replacements are placed in place
   * @param {*} node the element to replace
   * @param {*} replacement the value that will be added
   */
  function replaceInPlace(node, replacement) {
    if (!node.getAttribute("original")) {
      node.setAttribute("original", node.innerHTML);
    }

    if (extensionSettings["howLongSetting"] == "Temporary") {
      if (node.classList.contains("complex-word")) {
        const originalWidth = node.offsetWidth;
        let replacementSpan = createNode("span", replacement, "replacement");
        replaceHTML(node, replacementSpan);

        const newWidth = node.offsetWidth;

        let paddingSpan = createNode("span", "", "padding-span");
        const padding = originalWidth > newWidth ? originalWidth - node.offsetWidth : 0;
        paddingSpan.style["padding-right"] = padding / 2 + "px";
        node.prepend(paddingSpan);
        node.appendChild(paddingSpan.cloneNode());
      } else {
        // let lenghtDiff = node.innerText.length - replacement.length;
        // var append = lenghtDiff > 0 ? "<span class=no-highlight>"  + "&ensp;".repeat(lenghtDiff) + "</span>": "";
        node.innerHTML = replacement;
      }
    } else {
      let replacementSpan = createNode("span", replacement, "replacement");
      replaceHTML(node, replacementSpan);
    }
  }

  /**
   * Helper function to actually add the replacement to the HTML content
   * @param {*} node the element to replace
   * @param {*} replacement the value that will be added
   */
  function replaceHTML(node, replacement) {
    node.innerHTML = "";
    if (typeof (replacement) == "object") {
      node.appendChild(replacement);
    } else {
      node.innerHTML = replacement;
    }
  }

  /**
   * Helper function to remove an in-place replacement
   * @param {*} node the element for which the simplification will be undone
   */
  function removeInPlace(node) {
    if (extensionSettings["howLongSetting"] == "Temporary" && extensionSettings["howMuchSetting"] != "Word") {
      let original = makeCleanText(node.getAttribute("original"));
      node.innerHTML = original;
    } else {
      node.innerHTML = node.getAttribute("original");
    }
  }
  


  
  /**
     * Helper function for when the replacements are showed in a tooltip
     * @param {*} node the element to replace
     * @param {*} replacement the value that will be added
     */
  function showToolTip(node, replacement) {
    if (extensionSettings["howLongSetting"] != "Permanent") {
      removeToolTips();
    }

    const id = node.id;
    const tooltipWrap = document.createElement("div");
    splitTextIntoNodes(replacement, tooltipWrap);

    tooltipWrap.classList.add("tooltip1");
    tooltipWrap.classList.add("replacement");
    tooltipWrap.id = "Popup" + id;

    node.insertBefore(tooltipWrap, node.firstChild);
    bringTooltipToFront(node, [tooltipWrap]);
  }

  /**
   * Helper function to ensure a tooltip is not behind anything else. Mostly helpful
   * for the permanent duration.
   * @param {*} node the element containing the tooltip
   * @param {*} tooltips any existing tooltips to move them behind
   */
  function bringTooltipToFront(node, tooltips) {
    // In case it's permanent and there are tooltips, bring the tooltip to the front...
    Array.from(node.parentNode.querySelectorAll(".tooltip1")).forEach(function (otherTooltip) {
      otherTooltip.style.zIndex = 2;
    });
    // and set the rest of the tooltips behind
    Array.from(tooltips).forEach(function (currTooltip) {
      currTooltip.style.zIndex = 3;
    });
  }

  /**
   * Helper function to remove all tooltips
   * @param {*} tooltips an optional list of existing tooltips to remove
   */
  function removeToolTips(tooltips = null) {
    if (!tooltips) {
      tooltips = document.querySelectorAll(".tooltip1");
    }

    Array.from(tooltips).forEach(function (tooltip) {
      toggleSwappedClass(false, tooltip.parentNode);
      tooltip.remove();
    });
  }




  /**
   * Helper function for when the replacements are showed off to the side
    * @param {*} node the element to replace
    * @param {*} replacement the value that will be added
   */
  function showSideTip(node, replacement) {
    let id = node.id;

    // Create a dialog box - this box contains "content" and "header".
    // Header contains the heading and close button
    const dialogBox = document.createElement("div");
    if (replacement) {
      const dialogContent = getSideTipContentEl(replacement);

      dialogBox.appendChild(dialogContent);

      dialogBox.setAttribute("id", `sidetip-${id}`);
      dialogBox.addEventListener("mouseenter", (event) => toggleSideTipHighlights(true, event.currentTarget));
      dialogBox.addEventListener("mouseleave", (event) => toggleSideTipHighlights(false, event.currentTarget));

      dialogBox.classList.add("modal1");
      dialogBox.classList.add("highlight");

      let modalContainer = document.getElementById("modal1-container");
      if (!modalContainer) {
        modalContainer = document.createElement("div");
        modalContainer.setAttribute("id", "modal1-container");
        modalContainer.appendChild(dialogBox);
        document.body.insertBefore(modalContainer, document.body.firstChild);
      } else {
        modalContainer.insertBefore(dialogBox, modalContainer.firstChild);
      }

      [...modalContainer.children]
        .sort((a, b) => a.id.localeCompare(b.id, undefined, {
          numeric: true,
          sensitivity: 'base'
        }))
        .forEach(node => modalContainer.appendChild(node));

      node.addEventListener("mouseenter", (event) => dialogBox.classList.add("highlight"));
      node.addEventListener("mouseleave", (event) => dialogBox.classList.remove("highlight"));

    } else {
      alert("Error: A simplification wasn't found for this.")
    }
  };

  /**
   * Helper function to remove replacements off to the side
   * @param {*} sideTip an optional side replacement to remove, otherwise all are removed
   */
  function removeSideTips(sideTip = null) {
    if (sideTip) {
      toggleSideTipHighlights(false, sideTip);
      toggleSwappedClass(false, getSideTipText(sideTip));
      sideTip.remove();
    } else {
      const container = document.querySelector("#modal1-container")
      if (container) {
        container.remove();
      }
    }
  };

  /**
   * Helper function to get a side replacement as an HTML element
   * @param {*} text the text to add to the element
   * @returns an HTML element for a side replacement
   */
  function getSideTipContentEl(text) {
    const dialogContent = createNode("div", "", "modal1-content")
    dialogContent.setAttribute("data-text", text);

    if (extensionSettings["howLongSetting"] == "Manual") {
      const closeButton = createNode("span", "", "close");
      closeButton.addEventListener("click", closeSideTip);
      dialogContent.appendChild(closeButton);
    }

    splitTextIntoNodes(text, dialogContent);

    return dialogContent;
  }

  /**
   * Add a class to highlight the text or a side replacement when the other 
   * is hovered over – essentially maps a side replacement to its original 
   * text for highlighting purposes.
   */
  function toggleSideTipHighlights(highlight, sideTip = null) {
    const textEl = getSideTipText(sideTip);
    const className = "highlight-mapped";
    if (highlight) {
      textEl.classList.add(className);
    } else {
      textEl.classList.remove(className);
    }
  };

  /**
   * Returns the corresponding element for a side replacement
   * @param {*} sideTip the side replacement to get the original text for
   * @returns an HTML element with the original text for a side replacement
   */
  function getSideTipText(sideTip) {
    const textID = sideTip.id.replace("sidetip-", "");
    return document.getElementById(textID);
  }

  /**
   * Callback function for the close button on a side replacement to delete it
   * @param {*} event the event triggered by the close button (contained within the side replacement)
   */
  function closeSideTip(event) {
    let sideTip = event.currentTarget.parentNode.parentNode;
    // Important to stop the propagation so that only the actual click on the x calls this
    event.stopPropagation();
    toggleReplacement(getSideTipText(sideTip));
  };
  




  /**
   * Helper function to get the appropriate swapped class (which signifies a text has a visible replacement)
   * for the appropriate whereToSetting (i.e. the location of the replacement)
   * @returns the class name (e.g. swapped-side or swapped-inplace)
   */
  function getSwappedClassName() {
    try {
      return `swapped-${extensionSettings["whereToSetting"].toLowerCase()}`;
    } catch(error) {
      return null;
    }
  }

  /**
   * Helper function to toggle the swapped class when a simplification is applied or reverted
   * @param {*} swapped whether the simplification was applied or reverted
   * @param {*} el the element that contains the original text for which the simplification will be
   * applied or reverted
   */
  function toggleSwappedClass(swapped, el = null) {
    const swappedClass = getSwappedClassName();
    if (el) {
      el.classList.toggle(swappedClass, swapped);
    } else {
      const swappedElements = document.getElementsByClassName(swappedClass);
      Array.from(swappedElements).forEach((el) => {
        el.classList.toggle(swappedClass, swapped);
      });
    }
  }

  /**
   * Helper function to actually swap an original with the replacement, especially
   * for larger quantities. This function is used by toggleReplacement.
   * @param {*} node the text element for which the replacements should be applied
   * @returns the original text element but with the simplifications applied
   */
  function setChildrenToOtherText(node) {
    let replacement = "";
    const childrenClassNames = {
      "complex-document": ".complex-paragraph",
      "complex-paragraph": ".sentence",
      "complex-sentence": ".complex-word",
    };

    let childrenClassName;

    for (let [parent, child] of Object.entries(childrenClassNames)) {
      if (node.classList.contains(parent)) {
        childrenClassName = child;
        break;
      }
    }

    Array.from(node.querySelectorAll(childrenClassName)).forEach(function (child) {
      replacement += toggleReplacement(child, is_node = true);
    });

    return replacement;
  }

  /**
   * Removes the clickable pointer after applying a simplification when using a permanent
   * duration
   */
  function removeClickablePointerWhenPermanent(node) {
    if (extensionSettings["howLongSetting"] == "Permanent") {
      let currNode = node;
      while (!currNode.classList.contains("clickable-pointer")) {
        if (currNode.parentNode) {
          currNode = currNode.parentNode;
          break;
        } else {
          return;
        }
      }
      currNode.classList.remove("clickable-pointer");
    }
  }

  /**
   * Creates a new HTML element with a given HTML tag
   * @param {*} type the HTML tag to use
   * @param {*} content the content to include in the node
   * @param {*} className any classname to apply to the node
   * @returns 
   */
  function createNode(type, content, className = null) {
    let newSpan = document.createElement(type);
    if (content.innerHTML) {
      newSpan.appendChild(content);
    } else {
      newSpan.innerHTML = content;
    }

    if (className) {
      newSpan.classList.add(className);
    }
    return newSpan;
  }

  /**
   * Splits texts into invidual spans and inserts them into a wrapper. Used to 
   * create tooltips or side replacements
   * @param {*} text the text to split
   * @param {*} wrapper the HTML element to wrap the text in
   */
  function splitTextIntoNodes(text, wrapper) {
    const br = createNode("br", "");

    text.split("\n").forEach(function (t, i, all) {
      const newNode = createNode("span", t);
      if (i != all.length - 1) {
        newNode.append(br.cloneNode(), br.cloneNode());
      }
      wrapper.appendChild(newNode);
    })
  }

  /**
   * Helper function to remove HTML markup from a text
   * @param {*} text the text to clean
   * @returns a clean version of text without any HTML markup
   */
  function makeCleanText(text) {
    var htmlToCleanObject = document.createElement("div");
    htmlToCleanObject.innerHTML = text;
    let cleanText = htmlToCleanObject.innerText;
    htmlToCleanObject.remove();
    return cleanText;
  }





  /**
   * If a Firebase URL is included in the FIREBASE_URL variable, this function
   * will log any changes (including a simplification being applied or reverted, or
   * a change of settings) into the respective Firebase. The {path} placehorder becomes
   * a participant ID if the participant ID is included as a URL parameter "participant."
   * This is helpful for research studies.
   */
  async function logChange(type, old = null, updated = null, x = null, y = null) {
    if (FIREBASE_URL) {
      var dataToLog = {
        "article_title": window.location.href,
        "current_setting": extensionSettings["simpSetting"],
        "type": type,
        "timestamp": Date.now()
      }

      if (type == "simplifying" || type == "undoing") {
        dataToLog.complex = old;
        dataToLog.replacement = updated;
        dataToLog.coordinates = {
          "x": x,
          "y": y
        }
      } else if (type.includes("switching")) {
        dataToLog.from = old;
        dataToLog.to = updated;
      }

      fetch(FIREBASE_URL.replace("{path}", "/" + getParticipant() + "/interactions"), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(dataToLog)
      }).
        then(response => response.json())
        .then(data => console.log(data));
    }
    
  }

  /**
   * This helper function gets a participant ID from a URL parameter called "participant."
   * @returns The participant ID assuming the URL parameter exists, or an empty string otherwise
   */
  function getParticipant() {
    let url  = window.location.search;
    let urlParams = new URLSearchParams(url);
    let participant = urlParams.get('participant');
    return participant ? participant : "";
  }

})();


////added

// Fetch mediaMap.json
let mediaMapReady = false;
fetch(chrome.runtime.getURL("mediaMap.json"))
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch mediaMap.json: ${response.statusText}`);
    }
    return response.json();
  })
  .then((data) => {
    window.mediaMap = data;
    mediaMapReady = true;
    console.log("Media map loaded successfully:", mediaMap);
  })
  .catch((error) => {
    console.error("Error loading mediaMap.json:", error);
  });

// Function to handle video popup
function handleVideoPopup(word) {
  console.log(`Handling video popup for word: "${word}"`);

  if (!mediaMapReady || !window.mediaMap) {
    alert("Media map is not loaded. Please try again later.");
    return;
  }

  const videoUrl = window.mediaMap[word];
  if (!videoUrl) {
    console.warn(`No video found for the word: "${word}"`);
    alert(`No video available for the word: "${word}"`);
    return;
  }

  const resolvedVideoUrl = chrome.runtime.getURL(videoUrl);
  console.log(`Resolved video URL for "${word}": ${resolvedVideoUrl}`);

  // Open a popup window to display the video
  const popupWindow = window.open("", "VideoPopup", "width=400,height=300");
  if (!popupWindow) {
    console.error("Popup window blocked or failed to open.");
    return;
  }

  popupWindow.document.write(`
    <html>
      <body>
        <video src="${resolvedVideoUrl}" controls autoplay style="width:100%;"></video>
      </body>
    </html>
  `);

  console.log(`Video popup displayed for word: "${word}"`);
}

// Debugging `handleVideoPopup` accessibility
console.log("handleVideoPopup function type:", typeof handleVideoPopup);

// Add listener for word selection
// Listener for word selection
document.addEventListener("mouseup", () => {
  const selectedWord = window.getSelection().toString().trim();
  console.log("Selected word:", selectedWord);

  if (!selectedWord) return;

  if (typeof handleVideoPopup === "function") {
    handleVideoPopup(selectedWord); // Pass selected word to the video popup system
  } else {
    console.error("handleVideoPopup is not defined. Ensure popup.js is loaded.");
  }
});


// Added

