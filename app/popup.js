// popup.js - define behavior for the popup/user interface

document.addEventListener("DOMContentLoaded", function (event) {

  // This variable needs to match the same variable on content.js, as that's where the extension settings are stored
  let CHROME_STORAGE_VAR = "atsp_settings";

  // This variable stores all the setting nodes, which use the class setting-node on popup.html
  var settingNodes = $(".setting-node");

  // This variable will store the settings in the JS file before/after sending them to Chrome storage
  var settings = {};

  // The value of this variable determines whether the extension has a toggle at the top to enable/disable it
  let USE_ENABLED_TOGGLE = false;


  // Setting this variable to True will use the values set in PRESET_VALUES for a given setting
  let USE_PRESET = false;

  /**
   * Using a specific setting as a key and an object of settings and values will set those presets for the given
   * setting.
   */ 
  var PRESET_VALUES = {
    "lexical": {
      "howMuchSetting": "Word",
      "highlightComplexToggle": true,
      "whereToSetting": "Popup",
      "howLongSetting": "Manual",
      "highlightReplacedToggle": true
    },
    "syntactic_and_lexical": {
      "howMuchSetting": "Sentence",
      "highlightComplexToggle": true,
      "whereToSetting": "InPlace",
      "howLongSetting": "Manual",
      "highlightReplacedToggle": true
    },
    "syntactic": {
      "howMuchSetting": "Sentence",
      "highlightComplexToggle": true,
      "whereToSetting": "InPlace",
      "howLongSetting": "Manual",
      "highlightReplacedToggle": true
    }
  }
  
  

  /**
   * Stores settings that are incompatible. Assign the incompatible settings
   * as a value to the corresponding setting as a key. This will gray out setting
   * provided as a key when any of the settings provided as values are selected.
   */
  let incompatible_settings = {
    "Word": ["syntactic_and_lexical", "syntactic"]
  }

  // Removes the toggle if its use is set to false
  if (!USE_ENABLED_TOGGLE) {
    $("#enabled").remove();
  }

  // Add the listener to all setting nodes to log a setting change any time they are changed
  settingNodes.on("change", async function () {
    logSettingChange(this, true);
  });

  


  /*
  * Goes through all the settings stored in Chrome storage and updates the extension accordingly.
  * If no settings are stored in Chrome storage, then this function call sets each setting to its
  * first value.
  */
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

      if (typeof status === 'undefined') {
        var selected = $(node).children("input")[0];
      } else if (typeof status === "boolean") {
        var selected = status ? $(node).children("input")[0] : null;
      } else {
        var selected = $("#" + status);
      }

      if (selected) {
        $(selected).prop("checked", true);
      };

      if (setting === "enabled") {
        $(node).children("input").prop("checked", status);
        toggleExtension();
      }

      logSettingChange(node, false);
      toggleIncompatible();
    });

  });



  /**
   * If USE_PRESET is set to true, when a setting that has a preset in
   * PRESET_VALUES is selected, the rest will be set to the given values
   * in the object.
   */
  function setPresets() {
    $(".setting-node:not(#enabled)").each(function() {
      console.log($(this));
      $(this).parent().removeClass("hide");
      console.log("removing class");
    });

    for (const [value, presets] of Object.entries(PRESET_VALUES)) {
      if (Object.values(settings).includes(value)) {
        console.log(value);
        for (const [setting, preset] of Object.entries(presets)) {
          $("#" + setting).parent().addClass("hide");
          settings[setting] = preset;
        };
      }
    }
  }


  /**
   * When USE_ENABLED_TOGGLE is set to true, this function will serve as a callback
   * to toggle the extension
   */
  function toggleExtension() {
    settingNodes.each(function(index, node) {
      if (!$(node).hasClass("do-not-disable")) {
        $(node).parent().toggleClass("disabled", !settings["enabled"]);
        $(node).children('input').each(function () {
          $(this).prop("disabled", !settings["enabled"]);
        });
      }
    });
  }


  /**
   * This function updates the settings in the settings variable, and on Chrome storage
   * Then, if updateContentJS is true, it sends an update to content.js indicating that
   * the settings were changed, which setting was last changed, and whether the text should
   * be reset (which is stored as a data-attribute in each setting node)
   * @param {*} setting_node the setting_node that was last updated
   * @param {*} updateContentJS whether content.js should be alerted of the change
   */ 
  function logSettingChange(setting_node, updateContentJS) {
    let setting = $(setting_node).attr("id");
    let resets = $(setting_node).data("resets");
    /* Toggles (e.g. highlightComplexToggle) only have one input, so check if that input is checked (i.e. the length of input:checked === 1)
    * Otherwise, get the ID of the selected input, which works for all buttong groups
    */
    if ($(setting_node).children("input").length === 1) {
      var value = $(setting_node).children("input:checked").length === 1;
    } else {
      var value = $(setting_node).children("input:checked").attr("id");
    }

    settings[setting] = value;
    if (USE_PRESET) setPresets();

    chrome.storage.sync.set({[CHROME_STORAGE_VAR]:settings}, function () {
      if (updateContentJS) {
        sendtoContentJS({
          from: "extension",
          settings: settings,
          updated: setting,
          resets: resets
        });
      }
    });


    if (setting === "enabled") {
      settings["enabled"] = value;
      toggleExtension();
    }

    toggleIncompatible();
  }


  /**
   * Helper function to toggle any incompatible settings when the respective
   * setting is selected. It relies on the variable incompatible_settings
   * and it's called any time a setting is changed
   */
  function toggleIncompatible() {
    if (settings["enabled"]) {
      for (const [to_disable, settings] of Object.entries(incompatible_settings)) {
        var incompatible = false;
        for (const setting of settings) {
          incompatible = ($("#" + setting).is(":checked"));
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

  /** 
   * Helper function to send data to content.js, used by logChange to
   * alter content.js of any changes in the extensions' settings
   */
  function sendtoContentJS(data) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, data);
    });
  }
  
});
