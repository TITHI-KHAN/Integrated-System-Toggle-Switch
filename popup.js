// Text-based System Code

document.addEventListener("DOMContentLoaded", function (event) {

  // ATS System Variables
  let CHROME_STORAGE_VAR = "atsp_settings";
  var settingNodes = $(".setting-node");
  var settings = {};
  let USE_ENABLED_TOGGLE = false;
  let USE_PRESET = false;

  // Preset values for ATS
  var PRESET_VALUES = {
    lexical: {
      howMuchSetting: "Word",
      highlightComplexToggle: true,
      whereToSetting: "Popup",
      howLongSetting: "Manual",
      highlightReplacedToggle: true,
    },
    syntactic_and_lexical: {
      howMuchSetting: "Sentence",
      highlightComplexToggle: true,
      whereToSetting: "InPlace",
      howLongSetting: "Manual",
      highlightReplacedToggle: true,
    },
    syntactic: {
      howMuchSetting: "Sentence",
      highlightComplexToggle: true,
      whereToSetting: "InPlace",
      howLongSetting: "Manual",
      highlightReplacedToggle: true,
    },
  };

  // Incompatible settings for ATS
  let incompatible_settings = {
    Word: ["syntactic_and_lexical", "syntactic"],
  };

  // Remove the toggle if not in use
  if (!USE_ENABLED_TOGGLE) {
    $("#enabled").remove();
  }

  // Listener for setting changes
  settingNodes.on("change", async function () {
    logSettingChange(this, true);
  });

  // Retrieve saved settings from Chrome storage
  chrome.storage.sync.get(CHROME_STORAGE_VAR, function (status) {
    if (status[CHROME_STORAGE_VAR]) {
      settings = status[CHROME_STORAGE_VAR];
    }

    if (!USE_ENABLED_TOGGLE) {
      settings["enabled"] = true;
    }

    settingNodes.each(function (index, node) {
      let setting = node.id;
      let status = settings[setting];

      if (typeof status === "undefined") {
        var selected = $(node).children("input")[0];
      } else if (typeof status === "boolean") {
        var selected = status ? $(node).children("input")[0] : null;
      } else {
        var selected = $("#" + status);
      }

      if (selected) {
        $(selected).prop("checked", true);
      }

      if (setting === "enabled") {
        $(node).children("input").prop("checked", status);
        toggleExtension();
      }

      logSettingChange(node, false);
      toggleIncompatible();
    });
  });

  // Preset behavior for ATS
  function setPresets() {
    $(".setting-node:not(#enabled)").each(function () {
      $(this).parent().removeClass("hide");
    });

    for (const [value, presets] of Object.entries(PRESET_VALUES)) {
      if (Object.values(settings).includes(value)) {
        for (const [setting, preset] of Object.entries(presets)) {
          $("#" + setting).parent().addClass("hide");
          settings[setting] = preset;
        }
      }
    }
  }

  // Enable/disable toggle behavior for ATS
  function toggleExtension() {
    settingNodes.each(function (index, node) {
      if (!$(node).hasClass("do-not-disable")) {
        $(node).parent().toggleClass("disabled", !settings["enabled"]);
        $(node).children("input").each(function () {
          $(this).prop("disabled", !settings["enabled"]);
        });
      }
    });
  }

  // Log setting changes for ATS
  function logSettingChange(setting_node, updateContentJS) {
    let setting = $(setting_node).attr("id");
    let resets = $(setting_node).data("resets");

    if ($(setting_node).children("input").length === 1) {
      var value = $(setting_node).children("input:checked").length === 1;
    } else {
      var value = $(setting_node).children("input:checked").attr("id");
    }

    settings[setting] = value;
    if (USE_PRESET) setPresets();

    chrome.storage.sync.set({ [CHROME_STORAGE_VAR]: settings }, function () {
      if (updateContentJS) {
        sendtoContentJS({
          from: "extension",
          settings: settings,
          updated: setting,
          resets: resets,
        });
      }
    });

    if (setting === "enabled") {
      settings["enabled"] = value;
      toggleExtension();
    }

    toggleIncompatible();
  }

  // Handle incompatible settings for ATS
  function toggleIncompatible() {
    if (settings["enabled"]) {
      for (const [to_disable, settings] of Object.entries(incompatible_settings)) {
        var incompatible = false;
        for (const setting of settings) {
          incompatible = $("#" + setting).is(":checked");
          if (incompatible) break;
        }
        $("#" + to_disable).prop("disabled", incompatible);
        $("#" + to_disable).toggleClass("disabled", incompatible);
        if (incompatible) break;
      }

      $("input:disabled").each(function (index, node) {
        if ($(node).is(":checked")) {
          $($(node).siblings("input")[0]).trigger("click");
        }
      });
    }
  }

  // Send updates to content.js
  function sendtoContentJS(data) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, data);
    });
  }

  // Video-Based System Code

  // Variables for greyed-out options
  const disabledSimplificationTypes = ["syntactic", "syntactic_and_lexical"];
  const disabledQuantities = ["Sentence", "Paragraph", "Document"];
  const highlightReplacedToggleId = "highlightReplacedToggle";

  // Disable inactive options for the video-based system
  function disableInactiveOptions() {
    disabledSimplificationTypes.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.disabled = true;
        input.onclick = (e) => e.preventDefault();
      }
    });

    disabledQuantities.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.disabled = true;
        input.onclick = (e) => e.preventDefault();
      }
    });

    const highlightReplacedInput = document.querySelector(`#${highlightReplacedToggleId} input`);
    if (highlightReplacedInput) {
      highlightReplacedInput.disabled = true;
      highlightReplacedInput.onclick = (e) => e.preventDefault();
    }
  }

  // Enable all options for the text-based system
  function enableAllOptions() {
    disabledSimplificationTypes.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.disabled = false;
        input.onclick = null;
      }
    });

    disabledQuantities.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.disabled = false;
        input.onclick = null;
      }
    });

    const highlightReplacedInput = document.querySelector(`#${highlightReplacedToggleId} input`);
    if (highlightReplacedInput) {
      highlightReplacedInput.disabled = false;
      highlightReplacedInput.onclick = null;
    }
  }

  // Persistent toggle state and apply appropriate UI
  const toggleSwitch = document.getElementById("toggleSwitch");
  toggleSwitch.addEventListener("change", () => {
    if (toggleSwitch.checked) {
      disableInactiveOptions(); // Adjust for video-based system
      chrome.storage.sync.set({ toggleState: "video" });
    } else {
      enableAllOptions(); // Restore ATS system
      chrome.storage.sync.set({ toggleState: "text" });
    }
  });

  // Restore toggle state on load
  chrome.storage.sync.get("toggleState", (data) => {
    if (data.toggleState === "video") {
      toggleSwitch.checked = true;
      disableInactiveOptions();
    } else {
      toggleSwitch.checked = false;
      enableAllOptions();
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const toggleSwitch = document.getElementById("toggleSwitch");
  let CHROME_STORAGE_VAR = "atsp_settings";

  if (!toggleSwitch) {
    console.error("Toggle switch element not found in the DOM.");
    return;
  }

  // Function to turn off "Highlight Replaced" in the video-based system
  function turnOffHighlightReplacedForVideo() {
    chrome.storage.sync.get(CHROME_STORAGE_VAR, (data) => {
      let settings = data[CHROME_STORAGE_VAR] || {};

      if (settings.toggleState === "video") {
        settings.highlightReplacedToggle = false;

        // Update Chrome storage and UI
        chrome.storage.sync.set({ [CHROME_STORAGE_VAR]: settings }, () => {
          const highlightReplacedToggle = document.querySelector(`#highlightReplacedToggle input`);
          if (highlightReplacedToggle) {
            highlightReplacedToggle.checked = false;
            highlightReplacedToggle.disabled = true;
            highlightReplacedToggle.parentElement.classList.add("disabled");
          }
        });
      }
    });
  }

  // Function to restore "Highlight Replaced" in the text-based system
  function restoreHighlightReplacedForText() {
    chrome.storage.sync.get(CHROME_STORAGE_VAR, (data) => {
      let settings = data[CHROME_STORAGE_VAR] || {};

      if (settings.toggleState === "text") {
        const highlightReplacedToggle = document.querySelector(`#highlightReplacedToggle input`);
        if (highlightReplacedToggle) {
          highlightReplacedToggle.disabled = false;
          highlightReplacedToggle.parentElement.classList.remove("disabled");
        }
      }
    });
  }

  // Handle toggle switch change
  toggleSwitch.addEventListener("change", () => {
    const isVideoMode = toggleSwitch.checked;

    if (isVideoMode) {
      // Video-based system
      chrome.storage.sync.get(CHROME_STORAGE_VAR, (data) => {
        let settings = data[CHROME_STORAGE_VAR] || {};
        settings.toggleState = "video";
        settings.highlightReplacedToggle = false; // Turn off "Highlight Replaced"

        chrome.storage.sync.set({ [CHROME_STORAGE_VAR]: settings }, () => {
          turnOffHighlightReplacedForVideo();
        });
      });
    } else {
      // Text-based system
      chrome.storage.sync.get(CHROME_STORAGE_VAR, (data) => {
        let settings = data[CHROME_STORAGE_VAR] || {};
        settings.toggleState = "text";

        chrome.storage.sync.set({ [CHROME_STORAGE_VAR]: settings }, () => {
          restoreHighlightReplacedForText();
        });
      });
    }
  });

  // Apply the correct state on page load
  chrome.storage.sync.get("toggleState", (data) => {
    if (data.toggleState === "video") {
      toggleSwitch.checked = true;
      turnOffHighlightReplacedForVideo();
    } else {
      toggleSwitch.checked = false;
      restoreHighlightReplacedForText();
    }
  });
});


// Video-Based System Code

// Video-Based System Code


// --- Video-Based System Code ---
let mediaMap = {}; // Global variable for storing the media map
let mediaMapReady = false;

// Function to fetch mediaMap with retry logic
function requestMediaMap() {
  chrome.runtime.sendMessage({ type: "getMediaMap" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError.message);
      setTimeout(requestMediaMap, 1000); // Retry after 1 second
      return;
    }
    if (response && response.mediaMap) {
      console.log("Media map received:", response.mediaMap);
      mediaMap = response.mediaMap;
      mediaMapReady = true;
    } else {
      console.warn("No response or empty media map.");
      setTimeout(requestMediaMap, 1000); // Retry if response is empty
    }
  });
}

// Initiate mediaMap request
requestMediaMap();

// Disable text-based options for location and duration
function disableTextBasedOptions() {
  const textBasedElements = document.querySelectorAll(".location-option, .duration-option");
  textBasedElements.forEach((element) => {
    element.disabled = true;
    element.style.pointerEvents = "none";
    element.style.opacity = "0.5";
  });
  console.log("Text-based options for location and duration disabled in video mode.");
}

// Enable text-based options for location and duration
function enableTextBasedOptions() {
  const textBasedElements = document.querySelectorAll(".location-option, .duration-option");
  textBasedElements.forEach((element) => {
    element.disabled = false;
    element.style.pointerEvents = "auto";
    element.style.opacity = "1";
  });
  console.log("Text-based options for location and duration enabled in text mode.");
}

// Handle toggle state changes
document.addEventListener("DOMContentLoaded", () => {
  const toggleSwitch = document.getElementById("toggleSwitch");

  if (!toggleSwitch) {
    console.error("Toggle switch not found. Check your HTML.");
    return;
  }

  toggleSwitch.addEventListener("change", (event) => {
    if (event.target.checked) {
      disableTextBasedOptions(); // Video-based system
    } else {
      enableTextBasedOptions(); // Text-based system
    }
  });

  // Handle startup state for toggling
  chrome.storage.sync.get("toggleState", (data) => {
    if (data.toggleState === "video") {
      disableTextBasedOptions();
    } else {
      enableTextBasedOptions();
    }
  });
});

// Function to handle video popup for selected words
function handleVideoPopup(word) {
  chrome.runtime.sendMessage({ type: "getMediaMap" }, (response) => {
    if (chrome.runtime.lastError) {
      alert("Media map is not loaded. Please wait and try again.");
      return;
    }

    const videoUrl = response.mediaMap ? response.mediaMap[word] : null;
    if (!videoUrl) {
      alert(`No video available for the word: "${word}"`);
      return;
    }

    const resolvedVideoUrl = chrome.runtime.getURL(videoUrl);

    chrome.storage.sync.get("atsp_settings", (data) => {
      const settings = data["atsp_settings"] || {};
      const location = settings.whereToSetting || "Popup";
      const duration = settings.howLongSetting || "Manual";

      if (location === "InPlace") {
        displayVideoInPlace(word, resolvedVideoUrl, duration);
      } else if (location === "Popup") {
        displayVideoPopup(word, resolvedVideoUrl, duration);
      } else if (location === "Side") {
        displayVideoSide(word, resolvedVideoUrl, duration);
      }
    });
  });
}

/// display video in place
function displayVideoInPlace(word, videoUrl, duration) {
  const selection = window.getSelection();
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  if (!range) {
    console.warn("No text selected.");
    return;
  }

  if (!videoUrl) {
    console.error("Invalid video URL:", videoUrl);
    return;
  }

  const rect = range.getBoundingClientRect();
  console.log("Bounding rect for InPlace:", rect);

  // Create the container for the video
  const videoContainer = document.createElement("div");
  videoContainer.style.position = "absolute";
  videoContainer.style.top = `${rect.top + window.scrollY}px`;
  videoContainer.style.left = `${rect.left + window.scrollX}px`;
  videoContainer.style.width = "300px";
  videoContainer.style.height = "200px";
  videoContainer.style.zIndex = "1000";
  videoContainer.style.backgroundColor = "#fff";
  videoContainer.style.overflow = "hidden";
  videoContainer.style.border = "1px solid #ccc";
  videoContainer.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
  videoContainer.style.borderRadius = "5px";

  const videoElement = document.createElement("video");
  videoElement.src = videoUrl;
  videoElement.controls = true;
  videoElement.style.width = "100%";
  videoElement.style.height = "100%";
  videoElement.autoplay = true;
  videoContainer.appendChild(videoElement);

  if (duration === "Manual") {
    const closeButton = createCloseButton(() => {
      console.log("Removing video container for InPlace.");
      videoContainer.remove();
    });
    videoContainer.appendChild(closeButton);
  }

  document.body.appendChild(videoContainer);

  if (duration === "Temporary") {
    setTimeout(() => videoContainer.remove(), 5000);
  } else if (duration === "Permanent") {
    videoElement.loop = true;
  }
}

// Display video on the popup
function displayVideoPopup(word, videoUrl, duration) {
  const selection = window.getSelection();
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  if (!range) {
    console.warn("No text selected.");
    return;
  }

  if (!videoUrl) {
    console.error("Video URL is invalid:", videoUrl);
    return;
  }

  const rect = range.getBoundingClientRect();

  const popup = document.createElement("div");
  popup.classList.add("video-container");
  popup.style.position = "absolute";
  popup.style.top = `${rect.top + window.scrollY - 210}px`;
  popup.style.left = `${rect.left + window.scrollX - 150}px`;
  popup.style.width = "300px";
  popup.style.height = "200px";
  popup.style.zIndex = "1000";
  popup.style.backgroundColor = "#fff";
  popup.style.border = "1px solid #ccc";
  popup.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
  popup.style.borderRadius = "5px";
  popup.style.overflow = "hidden";

  const videoElement = document.createElement("video");
  videoElement.src = videoUrl;
  videoElement.controls = true;
  videoElement.style.width = "100%";
  videoElement.style.height = "100%";
  videoElement.autoplay = true;
  popup.appendChild(videoElement);

  if (duration === "Manual") {
    const closeButton = createCloseButton(() => popup.remove());
    popup.appendChild(closeButton);
  }

  document.body.appendChild(popup);

  if (duration === "Temporary") {
    setTimeout(() => popup.remove(), 5000);
  } else if (duration === "Permanent") {
    videoElement.loop = true;
  }
}

// Display video on the side
function displayVideoSide(word, videoUrl, duration) {
  if (duration === "Permanent") {
    // Create a container for all videos in the sidebar
    let sidebarContainer = document.getElementById("sidebar-container");
    if (!sidebarContainer) {
      sidebarContainer = document.createElement("div");
      sidebarContainer.id = "sidebar-container";
      sidebarContainer.style.position = "fixed";
      sidebarContainer.style.top = "10px";
      sidebarContainer.style.right = "10px";
      sidebarContainer.style.width = "320px"; // Slightly wider for caption space
      sidebarContainer.style.maxHeight = "90%";
      sidebarContainer.style.overflowY = "auto"; // Enable scrolling if many videos
      sidebarContainer.style.backgroundColor = "#f9f9f9";
      sidebarContainer.style.border = "1px solid #ccc";
      sidebarContainer.style.padding = "5px";
      sidebarContainer.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
      sidebarContainer.style.borderRadius = "5px";
      document.body.appendChild(sidebarContainer);
    }

    // Create a new container for this specific video
    const videoContainer = document.createElement("div");
    videoContainer.style.marginBottom = "10px";
    videoContainer.style.backgroundColor = "#fff";
    videoContainer.style.border = "1px solid #ccc";
    videoContainer.style.borderRadius = "5px";
    videoContainer.style.overflow = "hidden";
    videoContainer.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";

    // Add video element
    const videoElement = document.createElement("video");
    videoElement.src = videoUrl;
    videoElement.controls = true;
    videoElement.style.width = "100%";
    videoElement.style.height = "200px"; // Fixed height
    videoElement.autoplay = true;
    videoElement.loop = true; // Ensure video loops
    videoContainer.appendChild(videoElement);

    // Add caption
    const caption = document.createElement("div");
    caption.innerText = `Location: Side, Duration: Permanent`;
    caption.style.textAlign = "center";
    caption.style.padding = "5px";
    caption.style.backgroundColor = "#eee";
    caption.style.borderTop = "1px solid #ccc";
    caption.style.fontSize = "12px";
    videoContainer.appendChild(caption);

    // Append video container to the sidebar container
    sidebarContainer.appendChild(videoContainer);

    // Highlight the selected word
    const selectedElement = window.getSelection().anchorNode.parentElement;
    if (selectedElement) {
      selectedElement.style.backgroundColor = "green";
      selectedElement.style.color = "white";
    }
  } else {
    // Handle other durations as usual
    const sideContainer = document.createElement("div");
    sideContainer.style.position = "fixed";
    sideContainer.style.top = "10px";
    sideContainer.style.right = "10px";
    sideContainer.style.width = "300px";
    sideContainer.style.backgroundColor = "#fff";
    sideContainer.style.border = "1px solid #ccc";

    const videoElement = document.createElement("video");
    videoElement.src = videoUrl;
    videoElement.controls = true;
    videoElement.style.width = "100%";
    videoElement.autoplay = true;
    sideContainer.appendChild(videoElement);

    if (duration === "Manual") {
      const closeButton = createCloseButton(() => sideContainer.remove());
      sideContainer.appendChild(closeButton);
    }

    document.body.appendChild(sideContainer);

    if (duration === "Temporary") {
      setTimeout(() => sideContainer.remove(), 5000);
    } else if (duration === "Permanent") {
      videoElement.loop = true;
    }
  }
}


function createCloseButton(onClick) {
  const button = document.createElement("span");
  button.className = "video-close";
  button.innerText = "X";

  // Apply styles for the close button
  button.style.position = "absolute";
  button.style.top = "5px";
  button.style.right = "5px";
  button.style.backgroundColor = "red";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "50%";
  button.style.width = "25px";
  button.style.height = "25px";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.fontSize = "14px";
  button.style.cursor = "pointer";
  button.style.zIndex = "1001";

  // Add hover effect
  button.addEventListener("mouseenter", () => {
    button.style.opacity = "0.8";
  });
  button.addEventListener("mouseleave", () => {
    button.style.opacity = "1";
  });

  // Add click event to execute the callback
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });

  return button;
}


// Listener
document.addEventListener("mouseup", () => {
  const selectedWord = window.getSelection().toString().trim();
  if (!selectedWord) return;

  handleVideoPopup(selectedWord); // Ensure `handleVideoPopup` fetches the correct `videoUrl`.
});
