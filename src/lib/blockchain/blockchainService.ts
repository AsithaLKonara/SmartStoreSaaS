import { ethers } from 'ethers';
import { prisma } from '../prisma';
import * as crypto from 'crypto';

export interface BlockchainTransaction {
  id: string;
  hash: string;
  type: 'payment' | 'supply_chain' | 'nft_mint' | 'smart_contract';
  from: string;
  to: string;
  amount?: number;
  currency: string;
  gasUsed?: number;
  gasPrice?: number;
  blockNumber?: number;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  metadata?: Record<string, any>;
  createdAt: Date;
  confirmedAt?: Date;
}

export interface SupplyChainRecord {
  id: string;
  productId: string;
  batchNumber: string;
  stage: 'manufactured' | 'shipped' | 'received' | 'sold' | 'returned';
  location: string;
  timestamp: Date;
  verifiedBy: string;
  transactionHash: string;
  metadata: {
    temperature?: number;
    humidity?: number;
    quality?: string;
    certifications?: string[];
    [key: string]: any;
  };
}

export interface SmartContract {
  id: string;
  name: string;
  address: string;
  abi: any[];
  type: 'escrow' | 'subscription' | 'marketplace' | 'nft' | 'governance';
  network: 'ethereum' | 'polygon' | 'binance' | 'arbitrum';
  deployedAt: Date;
  isActive: boolean;
}

export interface CryptocurrencyPayment {
  id: string;
  orderId: string;
  currency: 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'BNB' | 'MATIC';
  amount: number;
  exchangeRate: number;
  fiatAmount: number;
  fiatCurrency: string;
  walletAddress: string;
  transactionHash?: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}

export interface NFTCollection {
  id: string;
  name: string;
  description: string;
  symbol: string;
  contractAddress: string;
  network: string;
  totalSupply: number;
  mintedCount: number;
  royaltyPercentage: number;
  creatorAddress: string;
  isActive: boolean;
}

export interface NFTToken {
  id: string;
  collectionId: string;
  tokenId: number;
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  ownerAddress: string;
  mintedAt: Date;
  lastSalePrice?: number;
  isListed: boolean;
}

export class BlockchainService {
  private provider: ethers.Provider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contracts: Map<string, ethers.Contract> = new Map();

  constructor() {
    this.initializeProvider();
  }

  private async initializeProvider(): Promise<void> {
    try {
      // Initialize provider based on environment
      if (process.env.ETHEREUM_RPC_URL) {
        this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
      } else {
        // Fallback to local development
        this.provider = new ethers.JsonRpcProvider('http://localhost:8545');
      }

      // Initialize wallet if private key is provided
      if (process.env.BLOCKCHAIN_PRIVATE_KEY) {
        this.wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, this.provider);
      }
    } catch (error) {
      console.error('Failed to initialize blockchain provider:', error);
    }
  }

  /**
   * Deploy smart contract
   */
  async deploySmartContract(
    contractData: {
      name: string;
      type: SmartContract['type'];
      network: SmartContract['network'];
      bytecode: string;
      abi: any[];
      constructorArgs?: any[];
    }
  ): Promise<SmartContract> {
    try {
      if (!this.wallet || !this.provider) {
        throw new Error('Blockchain provider not initialized');
      }

      // Create contract factory
      const factory = new ethers.ContractFactory(contractData.abi, contractData.bytecode, this.wallet);
      
      // Deploy contract
      const contract = await factory.deploy(...(contractData.constructorArgs || []));
      await contract.waitForDeployment();
      
      const contractAddress = await contract.getAddress();

      // Store contract info in metadata (since we don't have a dedicated blockchain model)
      // In a real implementation, you'd want to create a dedicated BlockchainContract model
      const contractInfo = {
        id: crypto.randomBytes(32).toString('hex'),
        name: contractData.name,
        address: contractAddress,
        abi: contractData.abi,
        type: contractData.type,
        network: contractData.network,
        deployedAt: new Date(),
        isActive: true,
      };

      // Cache contract instance
      this.contracts.set(contractAddress, contract as any);

      return contractInfo;
    } catch (error) {
      console.error('Error deploying smart contract:', error);
      throw new Error('Failed to deploy smart contract');
    }
  }

  /**
   * Process cryptocurrency payment
   */
  async processCryptoPayment(
    orderId: string,
    currency: CryptocurrencyPayment['currency'],
    amount: number,
    customerWallet: string,
    organizationId: string
  ): Promise<CryptocurrencyPayment> {
    try {
      // Get current exchange rate
      const exchangeRate = await this.getCryptoExchangeRate(currency, 'USD');
      const fiatAmount = amount * exchangeRate;

      // Generate payment address (in production, use HD wallets)
      const paymentWallet = ethers.Wallet.createRandom();
      const paymentAddress = paymentWallet.address;

      // Create payment record using Payment model with metadata
      const payment = await prisma.payment.create({
        data: {
          orderId: orderId,
          amount: amount,
          currency: currency,
          method: 'cryptocurrency',
          status: "PENDING",
          organizationId: organizationId,
          metadata: {
            cryptoCurrency: currency,
            cryptoAmount: amount,
            exchangeRate: exchangeRate,
            walletAddress: paymentAddress,
            confirmations: 0,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
          }
        }
      });

      // Start monitoring for payment
      this.monitorCryptoPayment(payment.id, paymentAddress, amount, currency);

      return {
        id: payment.id,
        orderId: payment.orderId || '', // Provide default value for null
        currency,
        amount,
        exchangeRate,
        fiatAmount,
        fiatCurrency: 'USD',
        walletAddress: paymentAddress,
        transactionHash: undefined,
        confirmations: 0,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        createdAt: payment.createdAt,
      };
    } catch (error) {
      console.error('Error processing crypto payment:', error);
      throw new Error('Failed to process crypto payment');
    }
  }

  /**
   * Record supply chain event
   */
  async recordSupplyChainEvent(
    productId: string,
    batchNumber: string,
    stage: SupplyChainRecord['stage'],
    location: string,
    verifiedBy: string,
    metadata: Record<string, any> = {}
  ): Promise<SupplyChainRecord> {
    try {
      // Store supply chain record in ProductActivity with metadata
      const record = await prisma.productActivity.create({
        data: {
          productId: productId,
          type: "INVENTORY_UPDATE" as any, // Cast to any to bypass enum restriction
          description: `Supply chain update: ${stage} at ${location}`,
          metadata: {
            batchNumber: batchNumber,
            stage: stage,
            location: location,
            verifiedBy: verifiedBy,
            transactionHash: crypto.randomBytes(32).toString('hex'),
            timestamp: new Date(),
            ...metadata,
          },
        },
      });

      // Store on blockchain (in production)
      const transactionHash = await this.storeOnBlockchain({
        productId,
        batchNumber,
        stage,
        location,
        verifiedBy,
        timestamp: new Date(),
        ...metadata,
      });

      return {
        id: record.id,
        productId: record.productId,
        batchNumber,
        stage,
        location,
        timestamp: record.createdAt,
        verifiedBy,
        transactionHash,
        metadata: record.metadata as any,
      };
    } catch (error) {
      console.error('Error recording supply chain event:', error);
      throw new Error('Failed to record supply chain event');
    }
  }

  /**
   * Create NFT collection
   */
  async createNFTCollection(
    collectionData: {
      name: string;
      description: string;
      symbol: string;
      totalSupply: number;
      royaltyPercentage: number;
      creatorAddress: string;
    }
  ): Promise<NFTCollection> {
    try {
      // Deploy NFT contract on blockchain
      const contractAddress = await this.deployNFTContract(collectionData);

      // Store collection info in metadata (since we don't have a dedicated NFT model)
      const collection = {
        id: crypto.randomBytes(32).toString('hex'),
        name: collectionData.name,
        description: collectionData.description,
        symbol: collectionData.symbol,
        contractAddress,
        network: 'ethereum', // Default network
        totalSupply: collectionData.totalSupply,
        mintedCount: 0,
        royaltyPercentage: collectionData.royaltyPercentage,
        creatorAddress: collectionData.creatorAddress,
        isActive: true,
      };

      return collection;
    } catch (error) {
      console.error('Error creating NFT collection:', error);
      throw new Error('Failed to create NFT collection');
    }
  }

  /**
   * Mint NFT token
   */
  async mintNFT(
    collectionId: string,
    tokenData: {
      name: string;
      description: string;
      image: string;
      attributes: Array<{ trait_type: string; value: string | number }>;
      ownerAddress: string;
    }
  ): Promise<NFTToken> {
    try {
      // Get collection info (in real implementation, fetch from blockchain or database)
      const collection = {
        contractAddress: '0x...', // Would be fetched from collection
        network: 'ethereum',
      };

      // Mint token on blockchain
      const tokenId = Math.floor(Math.random() * 1000000); // Generate unique token ID
      const transactionHash = await this.mintNFTOnChain(
        collection.contractAddress,
        tokenId,
        tokenData.ownerAddress,
        tokenData
      );

      // Store token info in metadata
      const nftToken = {
        id: crypto.randomBytes(32).toString('hex'),
        collectionId,
        tokenId,
        name: tokenData.name,
        description: tokenData.description,
        image: tokenData.image,
        attributes: tokenData.attributes,
        ownerAddress: tokenData.ownerAddress,
        mintedAt: new Date(),
        lastSalePrice: undefined,
        isListed: false,
      };

      // Update collection minted count
      // In real implementation, update the collection record

      return nftToken;
    } catch (error) {
      console.error('Error minting NFT:', error);
      throw new Error('Failed to mint NFT');
    }
  }

  /**
   * Verify product authenticity using blockchain
   */
  async verifyProductAuthenticity(
    productId: string,
    batchNumber: string
  ): Promise<{
    isAuthentic: boolean;
    supplyChainHistory: SupplyChainRecord[];
    verificationScore: number;
  }> {
    try {
      // Get supply chain history from ProductActivity
      const activities = await prisma.productActivity.findMany({
        where: {
          productId,
          type: "INVENTORY_UPDATE" as any,
          metadata: {
            not: null
          }
        }
      });

      // Convert to SupplyChainRecord format
      const supplyChainHistory: SupplyChainRecord[] = activities.map((activity: any) => {
        const metadata = activity.metadata as any;
        return {
          id: activity.id,
          productId: activity.productId,
          batchNumber: metadata.batchNumber || '',
          stage: metadata.stage || 'manufactured',
          location: metadata.location || '',
          timestamp: activity.createdAt,
          verifiedBy: metadata.verifiedBy || '',
          transactionHash: metadata.transactionHash || '',
          metadata: metadata
        };
      });

      // Verify on blockchain
      let verificationScore = 0;
      for (const record of supplyChainHistory) {
        const isValid = await this.verifyBlockchainRecord(record.transactionHash);
        if (isValid) {
          verificationScore += 25; // 25 points per verified record
        }
      }

      const isAuthentic = verificationScore >= 75; // 75% threshold

      return {
        isAuthentic,
        supplyChainHistory,
        verificationScore,
      };
    } catch (error) {
      console.error('Error verifying product authenticity:', error);
      throw new Error('Failed to verify product authenticity');
    }
  }

  /**
   * Get supported cryptocurrencies
   */
  getSupportedCryptocurrencies(): Array<{
    symbol: string;
    name: string;
    network: string;
    decimals: number;
    isStablecoin: boolean;
  }> {
    return [
      { symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8, isStablecoin: false },
      { symbol: 'ETH', name: 'Ethereum', network: 'ethereum', decimals: 18, isStablecoin: false },
      { symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6, isStablecoin: true },
      { symbol: 'USDC', name: 'USD Coin', network: 'ethereum', decimals: 6, isStablecoin: true },
      { symbol: 'BNB', name: 'Binance Coin', network: 'binance', decimals: 18, isStablecoin: false },
      { symbol: 'MATIC', name: 'Polygon', network: 'polygon', decimals: 18, isStablecoin: false },
    ];
  }

  /**
   * Get cryptocurrency exchange rate
   */
  private async getCryptoExchangeRate(crypto: string, fiat: string): Promise<number> {
    try {
      // In production, use a real exchange rate API
      // For now, return mock rates
      const mockRates: Record<string, number> = {
        BTC: 45000,
        ETH: 3000,
        USDT: 1,
        USDC: 1,
        BNB: 300,
        MATIC: 0.8,
      };

      return mockRates[crypto] || 1;
    } catch (error) {
      console.error('Error getting exchange rate:', error);
      return 1;
    }
  }

  /**
   * Monitor cryptocurrency payment
   */
  private async monitorCryptoPayment(
    paymentId: string,
    address: string,
    expectedAmount: number,
    currency: string
  ): Promise<void> {
    // In production, implement blockchain monitoring
    // For now, just log the monitoring start
    console.log(`Monitoring payment ${paymentId} at address ${address}`);
    
    // Simulate payment confirmation after 30 seconds
    setTimeout(async () => {
      await this.confirmCryptoPayment(paymentId, 'mock_transaction_hash');
    }, 30000);
  }

  /**
   * Confirm cryptocurrency payment
   */
  private async confirmCryptoPayment(
    paymentId: string,
    transactionHash: string
  ): Promise<void> {
    try {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          metadata: {
            transactionHash,
            confirmations: 6,
            confirmedAt: new Date(),
          },
        },
      });
    } catch (error) {
      console.error('Error confirming crypto payment:', error);
    }
  }

  /**
   * Store data on blockchain
   */
  private async storeOnBlockchain(data: any): Promise<string> {
    // In production, this would store data on the actual blockchain
    // For now, return a mock transaction hash
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Deploy NFT contract
   */
  private async deployNFTContract(collectionData: any): Promise<string> {
    // In production, this would deploy an actual NFT contract
    // For now, return a mock contract address
    return `0x${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Mint NFT on blockchain
   */
  private async mintNFTOnChain(
    contractAddress: string,
    tokenId: number,
    ownerAddress: string,
    tokenData: any
  ): Promise<string> {
    // In production, this would mint an actual NFT
    // For now, return a mock transaction hash
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify blockchain record
   */
  private async verifyBlockchainRecord(transactionHash: string): Promise<boolean> {
    // In production, this would verify the actual blockchain record
    // For now, return true for mock records
    return transactionHash.startsWith('0x');
  }

  /**
   * Get network status
   */
  async getNetworkStatus(): Promise<{
    network: string;
    blockNumber: number;
    gasPrice: string;
    isConnected: boolean;
  }> {
    try {
      if (!this.provider) {
        return {
          network: 'unknown',
          blockNumber: 0,
          gasPrice: '0',
          isConnected: false,
        };
      }

      const [blockNumber, gasPrice] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getFeeData(),
      ]);

      return {
        network: 'ethereum',
        blockNumber,
        gasPrice: gasPrice.gasPrice?.toString() || '0',
        isConnected: true,
      };
    } catch (error) {
      console.error('Error getting network status:', error);
      return {
        network: 'unknown',
        blockNumber: 0,
        gasPrice: '0',
        isConnected: false,
      };
    }
  }

  private generateTransactionHash(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateWalletAddress(): string {
    return `0x${crypto.randomBytes(20).toString('hex')}`;
  }

  private generateContractId(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export const blockchainService = new BlockchainService();
