module.exports = {
  rebuildConfig: {},
  packagerConfig: {
    icon: 'src/icon.png' // or 'path/to/your/icon.png'
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // An URL to an ICO file to use as the application icon (displayed in Control Panel > Programs and Features).
        iconUrl: '/src/icon.ico',
        // The ICO file to use as the icon for the generated Setup.exe
        setupIcon: '/src/icon.ico'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: '/src/icon.png'
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
     {
      name: '@electron-forge/maker-wix',
      config: {
        icon: '/src/icon.ico'
      }
    }
  ],
};
