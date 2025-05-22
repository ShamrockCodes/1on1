
//const PeerManager = require('./peer.js');

// Global variables
let selectedSourceId = null;
let currentStream = null;
let remoteStream = null;
let cameraStream = null;

// Create a PeerManager instance
const peerManager = new PeerManager();
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');
  
  // Main UI elements
  const shareBtn = document.getElementById('share-btn');
  const stopBtn = document.getElementById('stop-btn');
  const startCamBtn = document.getElementById('start-cam-btn');
  const stopCamBtn = document.getElementById('stop-cam-btn');
  const localVideo = document.getElementById('local-video');
  const remoteVideo = document.getElementById('remote-video');
  const status = document.getElementById('status');
  const localVideoContainer = document.getElementById('local-video-container');
  const localVideoPlaceholder = document.getElementById('local-video-placeholder');
  const remoteVideoContainer = document.getElementById('remote-video-container');
  const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
  const remoteStatus = document.getElementById('remote-status');
  const localFullscreenBtn = document.getElementById('local-fullscreen-btn');
  const remoteFullscreenBtn = document.getElementById('remote-fullscreen-btn');
  const localPipBtn = document.getElementById('local-pip-btn');
  const remotePipBtn = document.getElementById('remote-pip-btn');
  
  // Peer connection elements
  const myPeerIdElement = document.getElementById('my-peer-id');
  const peerIdInput = document.getElementById('peer-id-input');
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const copyIdBtn = document.getElementById('copy-id');
  
  // Modal elements
  const screenModal = document.getElementById('screen-modal');
  const closeModalBtn = document.getElementById('close-modal');
  const cancelBtn = document.getElementById('cancel-btn');
  const startShareBtn = document.getElementById('start-share-btn');
  const sourceGrid = document.getElementById('source-grid');
  const loadingMessage = document.getElementById('loading-message');
  const errorMessage = document.getElementById('error-message');
  const shareAudio = document.getElementById('share-audio');
  
  // Initialize video elements
  localVideo.style.display = 'none';
  remoteVideo.style.display = 'none';
  
  // Set up PeerManager event handlers
  peerManager.onPeerOpen = (id) => {
    myPeerIdElement.textContent = id;
  };
  
  peerManager.onConnectionOpen = () => {
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    remoteStatus.textContent = 'Connected (establishing media)';
    remoteStatus.className = 'connection-status connecting';
  };
  
  peerManager.onConnectionClose = () => {
    clearRemoteStream();
    remoteStatus.textContent = 'Disconnected';
    remoteStatus.className = 'connection-status disconnected';
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    if (remoteFullscreenBtn) remoteFullscreenBtn.disabled = true;
    if (remotePipBtn) remotePipBtn.disabled = true;
  };
  
  peerManager.onStreamReceived = (stream) => {
    remoteStream = stream;
    remoteVideo.srcObject = stream;
    remoteVideo.style.display = 'block';
    remoteVideoPlaceholder.style.display = 'none';
    remoteVideoContainer.classList.add('active');
    if (remoteFullscreenBtn) remoteFullscreenBtn.disabled = false;
    if (remotePipBtn) remotePipBtn.disabled = false;
    remoteStatus.textContent = 'Connected';
    remoteStatus.className = 'connection-status connected';
  };
  
  peerManager.onStreamEnded = () => {
    clearRemoteStream();
  };
  
  peerManager.onPeerError = (err) => {
    status.textContent = `Peer error: ${err.type}`;
    if (err.type === 'peer-unavailable') {
      remoteStatus.textContent = 'Peer not found';
      remoteStatus.className = 'connection-status disconnected';
    }
  };
  
  peerManager.onPeerDisconnected = () => {
    status.textContent = 'Disconnected from signaling server. Attempting to reconnect...';
  };
  
  peerManager.onPeerClose = () => {
    status.textContent = 'Connection closed';
    myPeerIdElement.textContent = 'Not connected';
  };
  
  // Initialize PeerJS
  peerManager.initialize()
    .catch(error => {
      console.error('Failed to initialize PeerJS:', error);
      status.textContent = `Failed to initialize peer connection: ${error.message}`;
    });
  
// Set up event listeners for main UI
  shareBtn.addEventListener('click', openScreenSelectionModal);
  stopBtn.addEventListener('click', stopScreenShare);
  startCamBtn.addEventListener('click', startCamera);
  stopCamBtn.addEventListener('click', stopCamera);
  
  // Set up event listeners for peer connection
  connectBtn.addEventListener('click', () => {
    const peerId = peerIdInput.value.trim();
    if (!peerId) {
      alert('Please enter a valid peer ID');
      return;
    }
    
    remoteStatus.textContent = 'Connecting...';
    remoteStatus.className = 'connection-status connecting';
    
    peerManager.connectToPeer(peerId)
      .catch(error => {
        console.error('Connection error:', error);
        remoteStatus.textContent = 'Connection failed';
        remoteStatus.className = 'connection-status disconnected';
      });
  });
  
  disconnectBtn.addEventListener('click', () => {
    peerManager.disconnect();
  });
  
  copyIdBtn.addEventListener('click', copyPeerId);
  
  // Set up event listeners for modal
  closeModalBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  startShareBtn.addEventListener('click', () => {
    if (selectedSourceId) {
      startScreenShare(selectedSourceId, shareAudio.checked);
      closeModal();
    }
  });
  
  // Set up fullscreen buttons
  if (localFullscreenBtn) {
    localFullscreenBtn.addEventListener('click', () => toggleFullscreen(localVideo));
  }
  
  if (remoteFullscreenBtn) {
    remoteFullscreenBtn.addEventListener('click', () => toggleFullscreen(remoteVideo));
  }
  
  // Set up PiP buttons
  if (localPipBtn) {
    localPipBtn.addEventListener('click', () => togglePictureInPicture(localVideo));
  }
  
  if (remotePipBtn) {
    remotePipBtn.addEventListener('click', () => togglePictureInPicture(remoteVideo));
  }
  
  // Set up double-click to fullscreen
  localVideo.addEventListener('dblclick', () => toggleFullscreen(localVideo));
  remoteVideo.addEventListener('dblclick', () => toggleFullscreen(remoteVideo));
  
  // Function to open the screen selection modal
  async function openScreenSelectionModal() {
    // Reset modal state
    selectedSourceId = null;
    startShareBtn.disabled = true;
    loadingMessage.style.display = 'block';
    sourceGrid.innerHTML = '';
    errorMessage.style.display = 'none';
    shareAudio.checked = false;
    
    // Show the modal
    screenModal.style.display = 'block';
    
    // Load screen sources
    try {
      const sources = await window.electronAPI.getScreenSources();
      loadingMessage.style.display = 'none';
      
      if (sources.length === 0) {
        showError('No screen sources found.');
        return;
      }
      
      // Create UI for each source
      sources.forEach(source => {
        const sourceItem = document.createElement('div');
        sourceItem.className = 'source-item';
        sourceItem.dataset.id = source.id;
        
        const thumbnail = document.createElement('img');
        thumbnail.src = source.thumbnail;
        thumbnail.alt = source.name;
        
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = source.name;
        
        sourceItem.appendChild(thumbnail);
        sourceItem.appendChild(name);
        
        sourceItem.addEventListener('click', () => {
          // Remove selected class from all items
          document.querySelectorAll('.source-item').forEach(item => {
            item.classList.remove('selected');
          });
          
          // Add selected class to clicked item
          sourceItem.classList.add('selected');
          
          // Update selected source
          selectedSourceId = source.id;
          startShareBtn.disabled = false;
        });
        
        sourceGrid.appendChild(sourceItem);
      });
    } catch (error) {
      console.error('Error loading screen sources:', error);
      showError(`Error loading screen sources: ${error.message}`);
    }
  }
  
  // Function to close the modal
  function closeModal() {
    screenModal.style.display = 'none';
  }
  
  // Function to show error in modal
  function showError(message) {
    loadingMessage.style.display = 'none';
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
  }
  
  // Function to start screen sharing
  async function startScreenShare(sourceId, withAudio) {
    try {
      // Stop camera if it's active
      if (cameraStream) {
        stopCamera();
      }
      
      status.textContent = 'Starting screen share...';
      
      // First, capture video only (more reliable)
      const videoConstraints = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        }
      };
      
      // Get the video stream
      const videoStream = await navigator.mediaDevices.getUserMedia(videoConstraints);
      
      // Create a new MediaStream to combine tracks
      const combinedStream = new MediaStream();
      
      // Add all video tracks from the screen capture
      videoStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
      
      // If audio is requested, try to add it separately
      if (withAudio) {
        try {
          // On macOS and Windows, we need to use loopback audio capture
          const audioConstraints = {
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
              }
            },
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId
              }
            }
          };
          
          // Try to get audio - this might fail on some platforms
          const audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
          
          // Add any audio tracks to our combined stream
          audioStream.getAudioTracks().forEach(track => {
            combinedStream.addTrack(track);
            console.log('Added audio track:', track.label);
          });
          
          // Stop the video tracks from this stream since we only needed the audio
          audioStream.getVideoTracks().forEach(track => track.stop());
          
          status.textContent = 'Screen sharing active with system audio';
        } catch (audioError) {
          console.warn('Could not capture system audio:', audioError);
          status.textContent = 'Screen sharing active (audio capture failed)';
        }
      } else {
        status.textContent = 'Screen sharing active (no audio)';
      }
      
      // Display the combined stream in the local video element
      localVideo.srcObject = combinedStream;
      localVideo.style.display = 'block';
      localVideoPlaceholder.style.display = 'none';
      localVideoContainer.classList.add('active');
      
      // Store the stream for later cleanup
      currentStream = combinedStream;
      
      // Update UI
      shareBtn.disabled = true;
      stopBtn.disabled = false;
      startCamBtn.disabled = true;
      stopCamBtn.disabled = true;
      if (localFullscreenBtn) localFullscreenBtn.disabled = false;
      if (localPipBtn) localPipBtn.disabled = false;
      
      // Set the stream in the peer manager
      peerManager.setLocalStream(combinedStream);
      
      // Handle stream ending
      combinedStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error('Error starting screen share:', error);
      status.textContent = `Error: ${error.message}`;
    }
  }
  
  // Function to stop screen sharing
  function stopScreenShare() {
    if (currentStream) {
      // Stop all tracks
      currentStream.getTracks().forEach(track => {
        console.log(`Stopping track: ${track.kind} - ${track.label}`);
        track.stop();
      });
      
      // Reset video element
      localVideo.srcObject = null;
      localVideo.style.display = 'none';
      localVideoPlaceholder.style.display = 'block';
      localVideoContainer.classList.remove('active');
      
      // Remove the stream from peer connection
      peerManager.removeStream();
      peerManager.setLocalStream(null);
      
      // Clear the stored stream
      currentStream = null;
      
      // Update UI
      shareBtn.disabled = false;
      stopBtn.disabled = true;
      startCamBtn.disabled = false;
      stopCamBtn.disabled = true;
      if (localFullscreenBtn) localFullscreenBtn.disabled = true;
      if (localPipBtn) localPipBtn.disabled = true;
      status.textContent = 'Screen sharing stopped';
      
      // Exit PiP if active
      if (document.pictureInPictureElement === localVideo) {
        document.exitPictureInPicture().catch(err => {
          console.error('Error exiting PiP:', err);
        });
      }
    }
  }
  
  // Function to start camera
  async function startCamera() {
    try {
      // Stop screen sharing if it's active
      if (currentStream) {
        stopScreenShare();
      }
      
      status.textContent = 'Starting camera...';
      
      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      
      // Display the stream in the local video element
      localVideo.srcObject = stream;
      localVideo.style.display = 'block';
      localVideoPlaceholder.style.display = 'none';
      localVideoContainer.classList.add('active');
      
      // Store the stream for later cleanup
      cameraStream = stream;
      
      // Update UI
      shareBtn.disabled = true;
      stopBtn.disabled = true;
      startCamBtn.disabled = true;
      stopCamBtn.disabled = false;
      if (localFullscreenBtn) localFullscreenBtn.disabled = false;
      if (localPipBtn) localPipBtn.disabled = false;
      status.textContent = 'Camera active';
      
      // Set the stream in the peer manager
      peerManager.setLocalStream(stream);
    } catch (error) {
      console.error('Error starting camera:', error);
      status.textContent = `Error starting camera: ${error.message}`;
    }
  }
  
  // Function to stop camera
  function stopCamera() {
    if (cameraStream) {
      // Stop all tracks
      cameraStream.getTracks().forEach(track => {
        console.log(`Stopping track: ${track.kind} - ${track.label}`);
        track.stop();
      });
      
      // Reset video element
      localVideo.srcObject = null;
      localVideo.style.display = 'none';
      localVideoPlaceholder.style.display = 'block';
      localVideoContainer.classList.remove('active');
      
      // Remove the stream from peer connection
      peerManager.removeStream();
      peerManager.setLocalStream(null);
      
      // Clear the stored stream
      cameraStream = null;
      
      // Update UI
      shareBtn.disabled = false;
      stopBtn.disabled = true;
      startCamBtn.disabled = false;
      stopCamBtn.disabled = true;
      if (localFullscreenBtn) localFullscreenBtn.disabled = true;
      if (localPipBtn) localPipBtn.disabled = true;
      status.textContent = 'Camera stopped';
      
      // Exit PiP if active
      if (document.pictureInPictureElement === localVideo) {
        document.exitPictureInPicture().catch(err => {
          console.error('Error exiting PiP:', err);
        });
      }
    }
  }
  
  // Function to clear remote stream
  function clearRemoteStream() {
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      remoteStream = null;
    }
    
    remoteVideo.srcObject = null;
    remoteVideo.style.display = 'none';
    remoteVideoPlaceholder.style.display = 'block';
    remoteVideoContainer.classList.remove('active');
    
    // Exit PiP if active
    if (document.pictureInPictureElement === remoteVideo) {
      document.exitPictureInPicture().catch(err => {
        console.error('Error exiting PiP:', err);
      });
    }
  }
  
  
 // Function to toggle fullscreen for a video element
function toggleFullscreen(videoElement) {
  if (!videoElement) return;
  
  try {
    // For Electron, we'll use the window's fullscreen mode
    if (window.electronAPI && window.electronAPI.toggleAppFullscreen) {
      window.electronAPI.toggleAppFullscreen()
        .then(isFullScreen => {
          if (isFullScreen) {
            // Make the video element fill the screen
            const originalStyles = {
              position: videoElement.style.position,
              top: videoElement.style.top,
              left: videoElement.style.left,
              width: videoElement.style.width,
              height: videoElement.style.height,
              zIndex: videoElement.style.zIndex
            };
            
            // Store original styles for restoration
            videoElement.dataset.originalStyles = JSON.stringify(originalStyles);
            
            // Apply fullscreen styles
            videoElement.style.position = 'fixed';
            videoElement.style.top = '0';
            videoElement.style.left = '0';
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.zIndex = '9999';
            
            // Add an exit button
            const exitBtn = document.createElement('button');
            exitBtn.textContent = 'Exit Fullscreen';
            exitBtn.style.position = 'fixed';
            exitBtn.style.top = '20px';
            exitBtn.style.right = '20px';
            exitBtn.style.zIndex = '10000';
            exitBtn.style.padding = '10px 15px';
            exitBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            exitBtn.style.color = 'white';
            exitBtn.style.border = 'none';
            exitBtn.style.borderRadius = '4px';
            exitBtn.style.cursor = 'pointer';
            exitBtn.id = 'exit-fullscreen-btn';
            
            exitBtn.addEventListener('click', () => {
              toggleFullscreen(videoElement);
            });
            
            document.body.appendChild(exitBtn);
          } else {
            // Restore original styles
            if (videoElement.dataset.originalStyles) {
              const originalStyles = JSON.parse(videoElement.dataset.originalStyles);
              Object.assign(videoElement.style, originalStyles);
              delete videoElement.dataset.originalStyles;
            }
            
            // Remove exit button
            const exitBtn = document.getElementById('exit-fullscreen-btn');
            if (exitBtn) {
              exitBtn.remove();
            }
          }
        });
    } else {
      // Fall back to browser fullscreen API
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      } else {
        if (videoElement.requestFullscreen) {
          videoElement.requestFullscreen();
        } else if (videoElement.webkitRequestFullscreen) {
          videoElement.webkitRequestFullscreen();
        }
      }
    }
  } catch (error) {
    console.error('Fullscreen error:', error);
    status.textContent = 'Fullscreen failed: ' + error.message;
  }
}





  // Function to toggle Picture-in-Picture mode
  function togglePictureInPicture(videoElement) {
    if (!videoElement || !document.pictureInPictureEnabled) {
      console.warn('Picture-in-Picture not supported');
      status.textContent = 'Picture-in-Picture not supported in this browser';
      return;
    }
    
    try {
      if (document.pictureInPictureElement) {
        // If any element is in PiP mode, exit
        document.exitPictureInPicture();
      } else if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or higher
        // Request PiP for this video
        videoElement.requestPictureInPicture();
      } else {
        console.warn('Video not ready for PiP');
        status.textContent = 'Video not ready for Picture-in-Picture';
      }
    } catch (error) {
      console.error('PiP error:', error);
      status.textContent = 'Picture-in-Picture failed: ' + error.message;
    }
  }
// Function to copy the peer ID to clipboard with temporary button text change
// Function to copy the peer ID to clipboard with temporary button text change
function copyPeerId() {
  const peerId = peerManager.getPeerId();
  if (!peerId) return;
  
  // Use Electron's clipboard API if available
  if (window.electronAPI && window.electronAPI.clipboard && window.electronAPI.clipboard.writeText) {
    window.electronAPI.clipboard.writeText(peerId)
      .then(() => {
        showCopiedMessage();
      })
      .catch(err => {
        console.error('Electron clipboard error:', err);
        fallbackCopy();
      });
  } else {
    // Try browser clipboard API
    fallbackCopy();
  }
  
  function fallbackCopy() {
    try {
      // Try the modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(peerId)
          .then(() => {
            showCopiedMessage();
          })
          .catch(err => {
            console.error('Navigator clipboard error:', err);
            execCommandCopy();
          });
      } else {
        // Use the execCommand fallback
        execCommandCopy();
      }
    } catch (err) {
      console.error('Copy failed:', err);
      status.textContent = 'Failed to copy: ' + err.message;
    }
  }
  
  function execCommandCopy() {
    // Create a temporary input element
    const tempInput = document.createElement('input');
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    tempInput.value = peerId;
    document.body.appendChild(tempInput);
    
    // Select the text
    tempInput.focus();
    tempInput.select();
    
    try {
      // Execute copy command
      const successful = document.execCommand('copy');
      if (successful) {
        showCopiedMessage();
      } else {
        status.textContent = 'Copy command failed';
      }
    } catch (err) {
      console.error('execCommand error:', err);
      status.textContent = 'Copy failed: ' + err.message;
    }
    
    // Remove the temporary input
    document.body.removeChild(tempInput);
  }
  
  function showCopiedMessage() {
    // Save original button text
    const originalText = copyIdBtn.textContent;
    
    // Change button text to indicate success
    copyIdBtn.textContent = 'Copied!';
    
    // Reset button text after 2 seconds
    setTimeout(() => {
      copyIdBtn.textContent = originalText;
    }, 2000);
  }
}

  // Close modal if user clicks outside of it
  window.addEventListener('click', (event) => {
    if (event.target === screenModal) {
      closeModal();
    }
  });
  
  // Handle keyboard events (Escape to close modal)
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && screenModal.style.display === 'block') {
      closeModal();
    }
  });
  
  // Handle fullscreen change events
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  
  function handleFullscreenChange() {
    const isFullscreen = document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement || 
                        document.msFullscreenElement;
    
    console.log(isFullscreen ? 'Entered fullscreen mode' : 'Exited fullscreen mode');
  }
  
  // Handle PiP events if supported
  if ('pictureInPictureEnabled' in document) {
    localVideo.addEventListener('enterpictureinpicture', () => {
      console.log('Local video entered PiP mode');
    });
    
    localVideo.addEventListener('leavepictureinpicture', () => {
      console.log('Local video left PiP mode');
    });
    
    remoteVideo.addEventListener('enterpictureinpicture', () => {
      console.log('Remote video entered PiP mode');
    });
    
    remoteVideo.addEventListener('leavepictureinpicture', () => {
      console.log('Remote video left PiP mode');
    });
  }
  
  // Clean up resources when the page is unloaded
  window.addEventListener('beforeunload', () => {
    // Clean up streams
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
    
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    
    // Destroy peer manager
    peerManager.destroy();
    
    // Exit fullscreen if active
    const isFullscreen = document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement || 
                        document.msFullscreenElement;
    if (isFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
    
    // Exit PiP if active
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(err => {
        console.error('Error exiting PiP on unload:', err);
      });
    }
  });
});

