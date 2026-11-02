import * as React from 'react';

// The host provides React as a global and the bundle compiles JSX to
// React.createElement, so tests need the same global.
(globalThis as unknown as { React: typeof React }).React = React;
