/**
 * PeerJS Manager Module
 * Handles all peer-to-peer connection functionality
 */

class PeerManager {
  constructor() {
    this.peer = null;
    this.dataConnection = null;
    this.mediaConnection = null;
    this.localStream = null;
    this.onPeerOpen = null;
    this.onConnectionOpen = null;
    this.onConnectionClose = null;
    this.onConnectionError = null;
    this.onStreamReceived = null;
    this.onStreamEnded = null;
    this.onPeerError = null;
    this.onPeerDisconnected = null;
    this.onPeerClose = null;
    this.onDataReceived = null;
  }

  /**
   * Initialize PeerJS
   * @param {Object} options - PeerJS options
   * @returns {Promise} Resolves when peer is connected, rejects on error
   */
  initialize(options = {}) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Initializing PeerJS...');
        
        // Check if Peer is available from the CDN
        if (typeof Peer === 'undefined') {
          throw new Error('PeerJS not loaded. Make sure the CDN script is included in your HTML.');
        }
        
        // Default options
        const defaultOptions = {
          debug: 2,
          config: {
            'iceServers': [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        };
        
        // Merge default options with provided options
        const peerOptions = { ...defaultOptions, ...options };
        
        // Create a new Peer object
        this.peer = new Peer(null, peerOptions);
        
        console.log('PeerJS instance created');
        
        // Set up event handlers
        this.peer.on('open', (id) => {
          console.log('My peer ID is:', id);
          if (this.onPeerOpen) this.onPeerOpen(id);
          resolve(id);
        });
        
        this.peer.on('connection', (conn) => {
          console.log('Incoming data connection');
          
          // Close existing connection if any
          if (this.dataConnection) {
            this.dataConnection.close();
          }
          
          this.dataConnection = conn;
          this._setupDataConnection();
        });
        
        this.peer.on('call', (call) => {
          console.log('Incoming media call');
          
          // Close existing call if any
          if (this.mediaConnection) {
            this.mediaConnection.close();
          }
          
          this.mediaConnection = call;
          
          // Answer the call with our local stream if available
          call.answer(this.localStream);
          
          this._setupMediaConnection();
        });
        
        this.peer.on('error', (err) => {
          console.error('Peer error:', err);
          if (this.onPeerError) this.onPeerError(err);
          
          // Only reject if this is during initialization
          if (!this.peer.id) {
            reject(err);
          }
        });
        
        this.peer.on('disconnected', () => {
          console.log('Disconnected from signaling server');
          if (this.onPeerDisconnected) this.onPeerDisconnected();
          
          // Try to reconnect
          this.peer.reconnect();
        });
        
        this.peer.on('close', () => {
          console.log('Connection to signaling server closed');
          if (this.onPeerClose) this.onPeerClose();
        });
      } catch (error) {
        console.error('Failed to initialize PeerJS:', error);
        reject(error);
      }
    });
  }

  /**
   * Connect to a peer
   * @param {string} peerId - ID of the peer to connect to
   * @returns {Promise} Resolves when connected, rejects on error
   */
  connectToPeer(peerId) {
    return new Promise((resolve, reject) => {
      if (!peerId || !this.peer) {
        reject(new Error('Invalid peer ID or peer not initialized'));
        return;
      }
      
      try {
        // Create data connection
        this.dataConnection = this.peer.connect(peerId);
        
        // Set up one-time event for connection opening
        const openHandler = () => {
          this.dataConnection.off('open', openHandler);
          resolve(this.dataConnection);
        };
        
        // Set up one-time event for connection error
        const errorHandler = (err) => {
          this.dataConnection.off('error', errorHandler);
          reject(err);
        };
        
        this.dataConnection.on('open', openHandler);
        this.dataConnection.on('error', errorHandler);
        
        // Set up the regular data connection handlers
        this._setupDataConnection();
        
        // If we have a stream, call the peer
        if (this.localStream) {
          this.mediaConnection = this.peer.call(peerId, this.localStream);
          this._setupMediaConnection();
        }
      } catch (error) {
        console.error('Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from current peer
   */
  disconnect() {
    // Close connections
    if (this.dataConnection) {
      this.dataConnection.close();
      this.dataConnection = null;
    }
    
    if (this.mediaConnection) {
      this.mediaConnection.close();
      this.mediaConnection = null;
    }
    
    if (this.onConnectionClose) this.onConnectionClose();
  }

  /**
   * Set the local stream to be shared
   * @param {MediaStream} stream - The media stream to share
   */
  setLocalStream(stream) {
    this.localStream = stream;
    
    // If we have an active connection, update the stream
    if (this.dataConnection && this.dataConnection.open) {
      this.sendStream();
    }
  }

  /**
   * Send the current local stream to the connected peer
   */
  sendStream() {
    if (!this.dataConnection || !this.peer || !this.localStream) return;
    
    const remotePeerId = this.dataConnection.peer;
    console.log(`Sending stream to peer: ${remotePeerId}`);
    
    if (this.mediaConnection) {
      // Close existing call
      this.mediaConnection.close();
    }
    
    // Call the peer with our stream
    this.mediaConnection = this.peer.call(remotePeerId, this.localStream);
    this._setupMediaConnection();
  }

  /**
   * Remove the stream from the peer connection
   */
  removeStream() {
    if (this.mediaConnection) {
      this.mediaConnection.close();
      this.mediaConnection = null;
    }
  }

  /**
   * Send a message to the connected peer
   * @param {any} message - The message to send
   * @returns {boolean} True if message was sent, false otherwise
   */
  sendMessage(message) {
    if (this.dataConnection && this.dataConnection.open) {
      this.dataConnection.send(message);
      return true;
    }
    return false;
  }

  /**
   * Get the current peer ID
   * @returns {string|null} The peer ID or null if not connected
   */
  getPeerId() {
    return this.peer ? this.peer.id : null;
  }

  /**
   * Check if connected to a peer
   * @returns {boolean} True if connected to a peer
   */
  isConnected() {
    return !!(this.dataConnection && this.dataConnection.open);
  }

  /**
   * Destroy the peer connection and clean up
   */
  destroy() {
    if (this.dataConnection) {
      this.dataConnection.close();
    }
    
    if (this.mediaConnection) {
      this.mediaConnection.close();
    }
    
    if (this.peer) {
      this.peer.destroy();
    }
    
    this.dataConnection = null;
    this.mediaConnection = null;
    this.peer = null;
    this.localStream = null;
  }

  /**
   * Set up the data connection event handlers
   * @private
   */
  _setupDataConnection() {
    if (!this.dataConnection) return;
    
    this.dataConnection.on('open', () => {
      console.log('Data connection established');
      if (this.onConnectionOpen) this.onConnectionOpen();
      
      // If we have a local stream but no media connection yet, initiate a call
      if (this.localStream && !this.mediaConnection) {
        this.sendStream();
      }
    });
    
    this.dataConnection.on('data', (data) => {
      console.log('Received data:', data);
      if (this.onDataReceived) this.onDataReceived(data);
    });
    
    this.dataConnection.on('close', () => {
      console.log('Data connection closed');
      this.dataConnection = null;
      if (this.onConnectionClose) this.onConnectionClose();
    });
    
    this.dataConnection.on('error', (err) => {
      console.error('Data connection error:', err);
      if (this.onConnectionError) this.onConnectionError(err);
    });
  }

  /**
   * Set up the media connection event handlers
   * @private
   */
  _setupMediaConnection() {
    if (!this.mediaConnection) return;
    
    this.mediaConnection.on('stream', (stream) => {
      console.log('Received remote stream');
      if (this.onStreamReceived) this.onStreamReceived(stream);
    });
    
    this.mediaConnection.on('close', () => {
      console.log('Media connection closed');
      this.mediaConnection = null;
      if (this.onStreamEnded) this.onStreamEnded();
    });
    
    this.mediaConnection.on('error', (err) => {
      console.error('Media connection error:', err);
    });
  }
}

// Export the PeerManager class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PeerManager;
} else {
  // For browser use
  window.PeerManager = PeerManager;
}
