// The package identity read by the shared code (generated; technology-specific values live here).
export const PROFILE = {
  "pkg": "aquila-react-ai",
  "stack": "React",
  "id": "react",
  "preset": "node-react",
  "framework": "react",
  "frameworkRange": "^19.0.0",
  "lintPeers": {
    "eslint": "^9.24.0 || ^10.0.0",
    "typescript-eslint": "^8.20.0",
    "eslint-plugin-sonarjs": "^3.0.0 || ^4.0.0",
    "eslint-plugin-jest": "^28.10.0 || ^29.0.0",
    "eslint-plugin-unicorn": ">=65.0.1",
    "eslint-plugin-react": "^7.37.0",
    "eslint-plugin-react-hooks": "^5.0.0 || ^6.0.0 || ^7.0.0",
    "eslint-plugin-jsx-a11y": "^6.10.0"
  },
  "lint": {
    "plugins": {
      "react": "eslint-plugin-react",
      "react-hooks": "eslint-plugin-react-hooks",
      "jsx-a11y": "eslint-plugin-jsx-a11y"
    },
    "jsx": true,
    "envAccess": [
      "process.env",
      "import.meta.env"
    ],
    "envHint": "import the typed config",
    "decoratorMetadata": false
  },
  "qa": {
    "environment": "dev",
    "appUrl": null,
    "browsers": "Chrome, Firefox, Safari",
    "testUser": null
  }
};
