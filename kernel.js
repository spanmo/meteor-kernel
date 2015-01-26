////////////////////////////////////////////////////////////////////////////////
// Kernel RaiX 2014
////////////////////////////////////////////////////////////////////////////////

// General render engine
var renderFunctions = [];

// Functions that will be run when theres time for it
var deferedFunctions = [];

// Render loop global
Kernel = {};

// Max length of defered buffer
Kernel.maxDeferedLength = 100;

// Debug flag
Kernel.debug = false;

/**
 * Run render function
 * @param  {function}   Function to run in frame
 */
Kernel.onRender = function onRender(f) {
  renderFunctions.push(f);
  return Kernel;
};

/**
 * Run function when theres time for it in the render loop
 * @param  {function}   Function to run in frame when time permits it
 */
Kernel.defer = function defer(f) {
  deferedFunctions.push(f);
  return Kernel;
};

/**
 * Create alias function for defer
 * @type {[type]}
 */
Kernel.then = Kernel.defer;

/**
 * Create alias for onRender as run
 * @type {[type]}
 */
Kernel.run = Kernel.onRender;

Kernel.each = function KernelEach(items, f) {
  // XXX: for now depend on underscore
  _.each(items, function KernelEach_Item(item, key) {
    // Let render loop run this when theres time
    Kernel.defer(function KernelEachItem() {
      // Run the function
      f(item, key);
    });
  });

  return Kernel;
};

Kernel.autorun = Tracker.autorun;

Kernel.deferAutorun = function(f) {
  return Kernel.autorun(function KernelComputation(c) {
    if (c.firstRun) {
      // Let the first run be run normally
      f.call(this, c);
    } else {
      // On reruns we defer via the kernel
      Kernel.defer(function() {
        // Store current computation
        var prev = Tracker.currentComputation;

        // Set the new computation
        Tracker.currentComputation = c;//thisComputation;
        Tracker.active = !! Tracker.currentComputation;

        // Call function
        f.call(this, c);

        // Switch back
        Tracker.currentComputation = prev;
        Tracker.active = !! Tracker.currentComputation;
      });

    }
  });
};

// Overwrite
if (Tracker && Tracker.autorun) Tracker.autorun = Kernel.deferAutorun;
if (Deps && Deps.autorun) Deps.autorun = Tracker.autorun;
if (Meteor && Meteor.autorun) Meteor.autorun = Tracker.autorun;

/**
 * The frame rate limit is set matching 60 fps 1000/60
 * @type {Number}
 */
Kernel.frameRateLimit = 0; // 1000 / 60;

Kernel.deferedTimeLimit = 10; // ms

Kernel.currentFrame = 0;

var lastTimeStamp = null;

Kernel.loop = function renderLoop() {
  // Get timestamp
  var timestamp = +new Date();

  // Request animation frame at the beginning trying to maintain 60fps
  window.requestAnimationFrame(Kernel.loop);

  // Set initial value
  if (!lastTimeStamp) lastTimeStamp = timestamp;

  // Limit the cpu/gpu load constraint ourself to the frameRateLimit
  if (Kernel.frameRateLimit && Kernel.frameRateLimit > timestamp - lastTimeStamp) return;

  // Increase the frame counter
  Kernel.currentFrame++;

  // Run all render functions
  var renderLength = renderFunctions.length;

  while (renderLength--) {
    // Run normal function in frame
    (renderFunctions.shift())(timestamp, lastTimeStamp, Kernel.currentFrame);
  }

  // Flags for limiting verbosity
  var displayForcedDeferedCount = true;
  var displayDeferedCount = true;

  // Make sure we keep the Kernel.maxDeferedLength limit
  while (Kernel.maxDeferedLength >= 0 && deferedFunctions.length - Kernel.maxDeferedLength > 0) {
    // Display debug info
    if (Kernel.debug && displayForcedDeferedCount) {
      console.log('Kernel: force run of ' + (deferedFunctions.length - Kernel.maxDeferedLength) + ' defered functions');
      displayForcedDeferedCount=false;
    }

    // Force defered function to run
    (deferedFunctions.shift())(timestamp, lastTimeStamp, Kernel.currentFrame);
  }

  // Run defered functions - in the defered time frame
  while (deferedFunctions.length && (Date.now() - timestamp) < Kernel.deferedTimeLimit) {

    // Display debug info
    if (Kernel.debug && displayDeferedCount) {
      console.log('Kernel: current defered queue size', deferedFunctions.length);
      displayDeferedCount=false;
    }

    // Run the defered function
    (deferedFunctions.shift())(timestamp, lastTimeStamp, Kernel.currentFrame);
  }

  // Set last time stamp
  lastTimeStamp = timestamp;
}


// Initialize render loop
window.requestAnimationFrame(Kernel.loop);
