function initializeHovercards(container) {
  if (globalThis.github?.hovercards) {
    globalThis.github.hovercards.init(container);
  } else if (globalThis.setupTooltips) {
    globalThis.setupTooltips(container);
  } else {
    setTimeout(() => {
      const hovercardElements = container.querySelectorAll(
        "[data-hovercard-type]"
      );
      for (const element of hovercardElements) {
        element.addEventListener("mouseenter", handleHovercardMouseEnter);
        element.addEventListener("mouseleave", handleHovercardMouseLeave);
      }
    }, 100);
  }
}

function handleHovercardMouseEnter(event) {
  const element = event.target;
  const hovercardType = element.dataset.hovercardType;
  const hovercardUrl = element.dataset.hovercardUrl;

  if (!hovercardType || !hovercardUrl) return;

  const hovercardEvent = new CustomEvent("hovercard:show", {
    bubbles: true,
    detail: {
      type: hovercardType,
      url: hovercardUrl,
      target: element,
    },
  });

  element.dispatchEvent(hovercardEvent);
}

function handleHovercardMouseLeave(event) {
  const element = event.target;
  const hovercardEvent = new CustomEvent("hovercard:hide", {
    bubbles: true,
    detail: {
      target: element,
    },
  });

  element.dispatchEvent(hovercardEvent);
}