/*!
 * pulltorefreshjs v0.1.21
 * (c) Rafael Soto
 * Released under the MIT License.
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e=e||self).PullToRefresh=t()}(this,function(){"use strict";var e={pullStartY:null,pullMoveY:null,handlers:[],styleEl:null,events:null,dist:0,state:"pending",timeout:null,distResisted:0,supportsPassive:!1,supportsPointerEvents:"undefined"!=typeof window&&!!window.PointerEvent};try{window.addEventListener("test",null,{get passive(){e.supportsPassive=!0}})}catch(e){}var t,n={setupDOM:function(t){if(!t.ptrElement){var n=document.createElement("div");t.mainElement!==document.body?t.mainElement.parentNode.insertBefore(n,t.mainElement):document.body.insertBefore(n,document.body.firstChild),n.classList.add(t.classPrefix+"ptr"),n.innerHTML=t.getMarkup().replace(/__PREFIX__/g,t.classPrefix),t.ptrElement=n,"function"==typeof t.onInit&&t.onInit(t),e.styleEl||(e.styleEl=document.createElement("style"),e.styleEl.setAttribute("id","pull-to-refresh-js-style"),document.head.appendChild(e.styleEl)),e.styleEl.textContent=t.getStyles().replace(/__PREFIX__/g,t.classPrefix).replace(/\s+/g," ")}return t},onReset:function(t){t.ptrElement.classList.remove(t.classPrefix+"refresh"),t.ptrElement.style[t.cssProp]="0px",setTimeout(function(){t.ptrElement&&t.ptrElement.parentNode&&(t.ptrElement.parentNode.removeChild(t.ptrElement),t.ptrElement=null),e.state="pending"},t.refreshTimeout)},update:function(t){var n=t.ptrElement.querySelector("."+t.classPrefix+"icon"),s=t.ptrElement.querySelector("."+t.classPrefix+"text");n&&("refreshing"===e.state?n.innerHTML=t.iconRefreshing:n.innerHTML=t.iconArrow),s&&("releasing"===e.state&&(s.innerHTML=t.instructionsReleaseToRefresh),"pulling"!==e.state&&"pending"!==e.state||(s.innerHTML=t.instructionsPullToRefresh),"refreshing"===e.state&&(s.innerHTML=t.instructionsRefreshing))}},s=function(t){return e.pointerEventsEnabled&&e.supportsPointerEvents?t.screenY:t.touches[0].screenY},r=function(){var r;function i(t){var i=e.handlers.filter(function(e){return e.contains(t.target)})[0];e.enable=!!i,i&&"pending"===e.state&&(r=n.setupDOM(i),i.shouldPullToRefresh()&&(e.pullStartY=s(t)),clearTimeout(e.timeout),n.update(i))}function o(t){r&&r.ptrElement&&e.enable&&(e.pullStartY?e.pullMoveY=s(t):r.shouldPullToRefresh()&&(e.pullStartY=s(t)),"refreshing"!==e.state?("pending"===e.state&&(r.ptrElement.classList.add(r.classPrefix+"pull"),e.state="pulling",n.update(r)),e.pullStartY&&e.pullMoveY&&(e.dist=e.pullMoveY-e.pullStartY),e.distExtra=e.dist-r.distIgnore,e.distExtra>0&&(t.cancelable&&t.preventDefault(),r.ptrElement.style[r.cssProp]=e.distResisted+"px",e.distResisted=r.resistanceFunction(e.distExtra/r.distThreshold)*Math.min(r.distMax,e.distExtra),"pulling"===e.state&&e.distResisted>r.distThreshold&&(r.ptrElement.classList.add(r.classPrefix+"release"),e.state="releasing",n.update(r)),"releasing"===e.state&&e.distResisted<r.distThreshold&&(r.ptrElement.classList.remove(r.classPrefix+"release"),e.state="pulling",n.update(r)))):t.cancelable&&r.shouldPullToRefresh()&&e.pullStartY<e.pullMoveY&&t.preventDefault())}function l(){if(r&&r.ptrElement&&e.enable){if(clearTimeout(t),t=setTimeout(function(){r&&r.ptrElement&&"pending"===e.state&&n.onReset(r)},500),"releasing"===e.state&&e.distResisted>r.distThreshold)e.state="refreshing",r.ptrElement.style[r.cssProp]=r.distReload+"px",r.ptrElement.classList.add(r.classPrefix+"refresh"),e.timeout=setTimeout(function(){var e=r.onRefresh(function(){return n.onReset(r)});e&&"function"==typeof e.then&&e.then(function(){return n.onReset(r)}),e||r.onRefresh.length||n.onReset(r)},r.refreshTimeout);else{if("refreshing"===e.state)return;r.ptrElement.style[r.cssProp]="0px",e.state="pending"}n.update(r),r.ptrElement.classList.remove(r.classPrefix+"release"),r.ptrElement.classList.remove(r.classPrefix+"pull"),e.pullStartY=e.pullMoveY=null,e.dist=e.distResisted=0}}function a(){r&&r.mainElement.classList.toggle(r.classPrefix+"top",r.shouldPullToRefresh())}var d=e.supportsPassive?{passive:e.passive||!1}:void 0;return e.pointerEventsEnabled&&e.supportsPointerEvents?(window.addEventListener("pointerup",l),window.addEventListener("pointerdown",i),window.addEventListener("pointermove",o,d)):(window.addEventListener("touchend",l),window.addEventListener("touchstart",i),window.addEventListener("touchmove",o,d)),window.addEventListener("scroll",a),{onTouchEnd:l,onTouchStart:i,onTouchMove:o,onScroll:a,destroy:function(){e.pointerEventsEnabled&&e.supportsPointerEvents?(window.removeEventListener("pointerdown",i),window.removeEventListener("pointerup",l),window.removeEventListener("pointermove",o,d)):(window.removeEventListener("touchstart",i),window.removeEventListener("touchend",l),window.removeEventListener("touchmove",o,d)),window.removeEventListener("scroll",a)}}},i={distThreshold:60,distMax:80,distReload:50,distIgnore:0,mainElement:"body",triggerElement:"body",ptrElement:".ptr",classPrefix:"ptr--",cssProp:"min-height",iconArrow:"&#8675;",iconRefreshing:"&hellip;",instructionsPullToRefresh:"Pull down to refresh",instructionsReleaseToRefresh:"Release to refresh",instructionsRefreshing:"Refreshing",refreshTimeout:500,getMarkup:function(){return'\n<div class="__PREFIX__box">\n  <div class="__PREFIX__content">\n    <div class="__PREFIX__icon"></div>\n    <div class="__PREFIX__text"></div>\n  </div>\n</div>\n'},getStyles:function(){return"\n.__PREFIX__ptr {\n  box-shadow: inset 0 -3px 5px rgba(0, 0, 0, 0.12);\n  pointer-events: none;\n  font-size: 0.85em;\n  font-weight: bold;\n  top: 0;\n  height: 0;\n  transition: height 0.3s, min-height 0.3s;\n  text-align: center;\n  width: 100%;\n  overflow: hidden;\n  display: flex;\n  align-items: flex-end;\n  align-content: stretch;\n}\n\n.__PREFIX__box {\n  padding: 10px;\n  flex-basis: 100%;\n}\n\n.__PREFIX__pull {\n  transition: none;\n}\n\n.__PREFIX__text {\n  margin-top: .33em;\n  color: rgba(0, 0, 0, 0.3);\n}\n\n.__PREFIX__icon {\n  color: rgba(0, 0, 0, 0.3);\n  transition: transform .3s;\n}\n\n/*\nWhen at the top of the page, disable vertical overscroll so passive touch\nlisteners can take over.\n*/\n.__PREFIX__top {\n  touch-action: pan-x pan-down pinch-zoom;\n}\n\n.__PREFIX__release .__PREFIX__icon {\n  transform: rotate(180deg);\n}\n"},onInit:function(){},onRefresh:function(){return location.reload()},resistanceFunction:function(e){return Math.min(1,e/2.5)},shouldPullToRefresh:function(){return!window.scrollY}},o=["mainElement","ptrElement","triggerElement"],l=function(t){var n={};return Object.keys(i).forEach(function(e){n[e]=t[e]||i[e]}),n.refreshTimeout="number"==typeof t.refreshTimeout?t.refreshTimeout:i.refreshTimeout,o.forEach(function(e){"string"==typeof n[e]&&(n[e]=document.querySelector(n[e]))}),e.events||(e.events=r()),n.contains=function(e){return n.triggerElement.contains(e)},n.destroy=function(){clearTimeout(e.timeout);var t=e.handlers.indexOf(n);e.handlers.splice(t,1)},n};return{setPassiveMode:function(t){e.passive=t},setPointerEventsMode:function(t){e.pointerEventsEnabled=t},destroyAll:function(){e.events&&(e.events.destroy(),e.events=null),e.handlers.forEach(function(e){e.destroy()})},init:function(t){void 0===t&&(t={});var n=l(t);return e.handlers.push(n),n},_:{setupHandler:l,setupEvents:r,setupDOM:n.setupDOM,onReset:n.onReset,update:n.update}}});
//# sourceMappingURL=index.umd.min.js.map